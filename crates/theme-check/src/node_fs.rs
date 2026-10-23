//! theme-check-node `NodeFileSystem`: the real disk behind `file://` URIs.

use crate::context::{FileStat, FileSystem, FileType};
use crate::path;

pub struct NodeFileSystem;

impl FileSystem for NodeFileSystem {
    fn read_file(&self, uri: &str) -> Result<String, String> {
        // `readFile(path, 'utf8')` replaces invalid UTF-8.
        std::fs::read(path::fs_path(uri))
            .map(|b| String::from_utf8_lossy(&b).into_owned())
            .map_err(|e| e.to_string())
    }

    fn read_directory(&self, uri: &str) -> Result<Vec<(String, FileType)>, String> {
        let mut entries: Vec<(String, bool)> = std::fs::read_dir(path::fs_path(uri))
            .map_err(|e| e.to_string())?
            .map(|entry| {
                let entry = entry.map_err(|e| e.to_string())?;
                // `Dirent.isDirectory()` doesn't follow symlinks.
                Ok((
                    entry.file_name().to_string_lossy().into_owned(),
                    entry.file_type().is_ok_and(|t| t.is_dir()),
                ))
            })
            .collect::<Result<_, String>>()?;
        // libuv's scandir sorts entries with strcmp.
        entries.sort();
        let out = entries
            .into_iter()
            .map(|(name, is_dir)| {
                (
                    path::join(uri, &[&name]),
                    if is_dir {
                        FileType::Directory
                    } else {
                        FileType::File
                    },
                )
            })
            .collect();
        Ok(out)
    }

    fn stat(&self, uri: &str) -> Result<FileStat, String> {
        let meta = std::fs::metadata(path::fs_path(uri))
            .map_err(|e| format!("Failed to get file stat: {e}"))?;
        Ok(FileStat {
            file_type: if meta.is_dir() {
                FileType::Directory
            } else {
                FileType::File
            },
            size: meta.len() as usize,
        })
    }
}
