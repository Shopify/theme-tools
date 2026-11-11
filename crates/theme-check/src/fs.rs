//! Where a theme's files are read from, and the `file://` URIs the checks read them by.

use crate::context::{self, FileStat, FileType};
use crate::path;
use std::collections::BTreeMap;
use std::io;
use std::ops::Bound;
use std::path::{Path, PathBuf};

/// Where a theme's files are read from: the [`Disk`], a [`MemoryFs`], or your own.
pub trait FileSystem: Sync {
    /// The text of the file at `path`.
    fn read_to_string(&self, path: &Path) -> io::Result<String>;
    /// The entries of the directory at `path`, with whether each is a directory. A symbolic link
    /// isn't one, so links can't make a walk loop.
    fn read_dir(&self, path: &Path) -> io::Result<Vec<(PathBuf, bool)>>;
    /// The size of what's at `path` in bytes, or an error if there's nothing there.
    fn size(&self, path: &Path) -> io::Result<u64>;
}

/// The files on disk.
#[derive(Clone, Copy, Debug, Default)]
pub struct Disk;

impl FileSystem for Disk {
    fn read_to_string(&self, path: &Path) -> io::Result<String> {
        // Node's `readFile(path, 'utf8')` replaces invalid UTF-8.
        std::fs::read(path).map(|b| String::from_utf8_lossy(&b).into_owned())
    }

    fn read_dir(&self, path: &Path) -> io::Result<Vec<(PathBuf, bool)>> {
        let mut entries = std::fs::read_dir(path)?
            .map(|entry| {
                let entry = entry?;
                // `file_type` doesn't follow symlinks, like Node's `Dirent.isDirectory()`.
                Ok((
                    entry.file_name(),
                    entry.file_type().is_ok_and(|t| t.is_dir()),
                ))
            })
            .collect::<io::Result<Vec<_>>>()?;
        // libuv's scandir sorts entries with strcmp.
        entries.sort();
        Ok(entries
            .into_iter()
            .map(|(name, is_dir)| (path.join(name), is_dir))
            .collect())
    }

    fn size(&self, path: &Path) -> io::Result<u64> {
        Ok(std::fs::metadata(path)?.len())
    }
}

/// Files in memory, by absolute path, like `/theme/layout/theme.liquid`. The directories are
/// their parents.
///
/// ```
/// let fs: theme_check::MemoryFs = [("/theme/snippets/a.liquid", "{{ 'x' | nope }}")]
///     .into_iter()
///     .collect();
/// ```
#[derive(Clone, Debug, Default)]
pub struct MemoryFs(BTreeMap<PathBuf, String>);

impl<P: Into<PathBuf>, S: Into<String>> FromIterator<(P, S)> for MemoryFs {
    fn from_iter<I: IntoIterator<Item = (P, S)>>(files: I) -> Self {
        MemoryFs(
            files
                .into_iter()
                .map(|(p, s)| (p.into(), s.into()))
                .collect(),
        )
    }
}

impl MemoryFs {
    /// The paths below `dir`.
    fn below<'a>(&'a self, dir: &'a Path) -> impl Iterator<Item = &'a Path> + 'a {
        self.0
            .range::<Path, _>((Bound::Included(dir), Bound::Unbounded))
            .map(|(p, _)| p.as_path())
            .take_while(move |p| p.starts_with(dir))
            .filter(move |p| *p != dir)
    }
}

fn not_found(path: &Path) -> io::Error {
    io::Error::new(
        io::ErrorKind::NotFound,
        format!("no such file or directory: {}", path.display()),
    )
}

impl FileSystem for MemoryFs {
    fn read_to_string(&self, path: &Path) -> io::Result<String> {
        self.0.get(path).cloned().ok_or_else(|| not_found(path))
    }

    // ponytail: a scan of the files below `path` per call. Index directories if themes get huge.
    fn read_dir(&self, path: &Path) -> io::Result<Vec<(PathBuf, bool)>> {
        let mut entries: Vec<(PathBuf, bool)> = Vec::new();
        for p in self.below(path) {
            let rest = p.strip_prefix(path).expect("below `path`");
            let name = rest.components().next().expect("not `path` itself");
            let entry = (path.join(name), rest.components().nth(1).is_some());
            if entries.last() != Some(&entry) {
                entries.push(entry);
            }
        }
        if entries.is_empty() {
            return Err(not_found(path));
        }
        Ok(entries)
    }

    fn size(&self, path: &Path) -> io::Result<u64> {
        match self.0.get(path) {
            Some(text) => Ok(text.len() as u64),
            None if self.below(path).next().is_some() => Ok(0),
            None => Err(not_found(path)),
        }
    }
}

/// The `.liquid` and `.json` files below `dir` in `fs`, like `getTheme`'s glob, without dot
/// entries. It fails on a directory that can't be listed, with its path.
pub(crate) fn theme_files(
    fs: &dyn FileSystem,
    dir: &Path,
    out: &mut Vec<PathBuf>,
) -> io::Result<()> {
    let entries = fs
        .read_dir(dir)
        .map_err(|e| io::Error::new(e.kind(), format!("{}: {e}", dir.display())))?;
    for (p, is_dir) in entries {
        let name = p.file_name().unwrap_or_default().to_string_lossy();
        if name.starts_with('.') {
            continue;
        }
        if is_dir {
            // ponytail: ignored directories like `node_modules` are walked too, so one that can't
            // be listed fails the run. Skip ignored directories here if that happens.
            theme_files(fs, &p, out)?;
        } else if name.ends_with(".liquid") || name.ends_with(".json") {
            out.push(p);
        }
    }
    Ok(())
}

/// A [`FileSystem`] by the `file://` URIs of its paths, as the checks read it.
pub(crate) struct Uris<'a>(pub &'a dyn FileSystem);

impl context::FileSystem for Uris<'_> {
    fn read_file(&self, uri: &str) -> Result<String, String> {
        self.0
            .read_to_string(Path::new(&path::fs_path(uri)))
            .map_err(|e| e.to_string())
    }

    fn read_directory(&self, uri: &str) -> Result<Vec<(String, FileType)>, String> {
        let entries = self
            .0
            .read_dir(Path::new(&path::fs_path(uri)))
            .map_err(|e| e.to_string())?;
        Ok(entries
            .into_iter()
            .map(|(p, is_dir)| {
                (
                    path::file_uri(&p.to_string_lossy()),
                    if is_dir {
                        FileType::Directory
                    } else {
                        FileType::File
                    },
                )
            })
            .collect())
    }

    fn stat(&self, uri: &str) -> Result<FileStat, String> {
        let size = self
            .0
            .size(Path::new(&path::fs_path(uri)))
            .map_err(|e| format!("Failed to get file stat: {e}"))?;
        Ok(FileStat {
            size: size as usize,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_fs_lists_directories_from_paths() {
        let fs: MemoryFs = [
            ("/t/a.liquid", "a"),
            ("/t/b/c.liquid", "cc"),
            ("/t/b/d/e.json", "{}"),
            ("/tt/x.liquid", ""),
        ]
        .into_iter()
        .collect();
        let dir = |p: &str| fs.read_dir(Path::new(p)).map_err(|e| e.kind());
        assert_eq!(
            dir("/t"),
            Ok(vec![("/t/a.liquid".into(), false), ("/t/b".into(), true)])
        );
        assert_eq!(
            dir("/t/b"),
            Ok(vec![
                ("/t/b/c.liquid".into(), false),
                ("/t/b/d".into(), true)
            ])
        );
        assert_eq!(dir("/t/a.liquid").unwrap_err(), io::ErrorKind::NotFound);
        assert_eq!(fs.size(Path::new("/t/b/c.liquid")).unwrap(), 2);
        assert_eq!(fs.size(Path::new("/t/b")).unwrap(), 0);
        assert!(fs.size(Path::new("/t/z")).is_err());
    }
}
