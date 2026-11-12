//! Theme Check, the linter for Shopify themes.
//!
//! ```no_run
//! let report = theme_check::check("path/to/theme".as_ref(), None)?;
//! for offense in &report.offenses {
//!     let line = offense.start.line + 1;
//!     println!("{}:{line} {}: {}", offense.path.display(), offense.check, offense.message);
//! }
//! # Ok::<(), theme_check::Error>(())
//! ```
//!
//! Or with the files, docs, schemas and checks you give it:
//!
//! ```
//! use theme_check::{Checker, Docs, MemoryFs};
//!
//! let fs: MemoryFs = [("/theme/snippets/a.liquid", "{{ 'x' | nope }}")]
//!     .into_iter()
//!     .collect();
//! let docs = Docs::from_json(r#"[{"name": "upcase"}]"#, "[]", "[]", "{}")?;
//! let report = Checker::new()
//!     .docs(docs)
//!     .schemas(Vec::new())
//!     .checks(theme_check::checks().filter(|c| c.code == "UnknownFilter"))
//!     .run(&fs, "/theme")?;
//! assert_eq!(report.offenses[0].message, "Unknown filter 'nope' used.");
//! # Ok::<(), theme_check::Error>(())
//! ```
//!
//! Checks of your own walk the [`ast`]:
//!
//! ```
//! use theme_check::ast::{NodeKind, NodeRef};
//! use theme_check::{Check, CheckResult, Checker, Context, Create, Docs, LiquidCheck, MemoryFs};
//!
//! struct NoInclude;
//!
//! impl<'a> LiquidCheck<'a> for NoInclude {
//!     fn kinds(&self) -> &'static [NodeKind] {
//!         &[NodeKind::LiquidTag]
//!     }
//!     fn enter(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
//!         if let NodeRef::LiquidTag(tag) = node {
//!             if tag.name == "include" {
//!                 cx.report("Use render, not include.", tag.span);
//!             }
//!         }
//!         Ok(())
//!     }
//! }
//!
//! static NO_INCLUDE: Check = Check {
//!     code: "NoInclude",
//!     name: "Use render, not include",
//!     aliases: &[],
//!     severity: theme_check::Severity::Warning,
//!     recommended: false,
//!     deprecated: false,
//!     schema: &[],
//!     create: Create::Liquid(|_| Some(Box::new(NoInclude))),
//! };
//!
//! let fs: MemoryFs = [("/theme/snippets/a.liquid", "{% include 'b' %}")]
//!     .into_iter()
//!     .collect();
//! let report = Checker::new()
//!     .docs(Docs::from_json("[]", "[]", "[]", "{}")?)
//!     .schemas(Vec::new())
//!     .checks([&NO_INCLUDE])
//!     .run(&fs, "/theme")?;
//! assert_eq!(report.offenses[0].message, "Use render, not include.");
//! # Ok::<(), theme_check::Error>(())
//! ```

// The port's internals, for the CLI and the specs. They aren't part of the API.
#[doc(hidden)]
pub mod block_parameters;
#[doc(hidden)]
pub mod checks;
#[doc(hidden)]
pub mod context;
#[doc(hidden)]
pub mod docs;
#[doc(hidden)]
pub mod docset;
#[doc(hidden)]
pub mod fixes;
mod fs;
#[doc(hidden)]
pub mod graph;
#[doc(hidden)]
pub mod js;
#[doc(hidden)]
pub mod json;
#[doc(hidden)]
pub mod json_validator;
#[doc(hidden)]
pub mod liquid_doc;
#[doc(hidden)]
pub mod minimatch;
#[doc(hidden)]
pub mod node;
#[doc(hidden)]
pub mod path;
#[doc(hidden)]
pub mod runner;
#[doc(hidden)]
pub mod schema;
#[doc(hidden)]
pub mod source;
#[doc(hidden)]
pub mod visible_if;
#[doc(hidden)]
pub mod visitor;
#[doc(hidden)]
pub mod yaml;

pub use context::{
    CheckDef as Check, CheckError, CheckResult, Context, Create, LiquidCheck, Severity,
};
pub use docs::Schema;
pub use fs::{Disk, FileSystem, MemoryFs};
pub use liquid_ast as ast;

use context::{Config, Mode};
use serde_json::{Map, Value};
use source::{to_source_code, SourceCode};
use std::collections::HashMap;
use std::fmt;
use std::ops::Range;
use std::path::{Path, PathBuf};

/// What a run found.
#[derive(Clone, Debug)]
#[non_exhaustive]
pub struct Report {
    /// In file order.
    pub offenses: Vec<Offense>,
    /// The files that were checked.
    pub files: Vec<PathBuf>,
}

#[derive(Clone, Debug)]
#[non_exhaustive]
pub struct Offense {
    /// The check's name, like `UnknownFilter`.
    pub check: &'static str,
    pub path: PathBuf,
    pub message: String,
    pub severity: Severity,
    /// Byte offsets in the file.
    pub range: Range<usize>,
    pub start: Position,
    pub end: Position,
}

/// A place in a file: a 0-based line, and a byte offset in that line.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Position {
    pub line: usize,
    pub column: usize,
}

/// Why a run failed, like a config that can't be read.
#[derive(Clone, Debug)]
pub struct Error(String);

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Error {}

impl From<node::JsError> for Error {
    fn from(e: node::JsError) -> Self {
        Error(e.message)
    }
}

/// Checks the theme at `root` on disk. The config is `config`, else the theme's
/// `.theme-check.yml`, else the recommended checks. A [`Checker`] takes files, docs, schemas and
/// checks of your own.
pub fn check(root: &Path, config: Option<&Path>) -> Result<Report, Error> {
    let config = config.map(resolve);
    let (_, report) = node::run(&resolve(root), config.as_deref(), Box::new(|_| {}), report)?;
    Ok(report)
}

/// Checks the theme at `root` like [`check`], and writes the fixes that are safe to apply.
pub fn fix(root: &Path, config: Option<&Path>) -> Result<(), Error> {
    let config = config.map(resolve);
    Ok(node::check_and_autofix(&resolve(root), config.as_deref())?)
}

/// `path` made absolute, as the CLI does.
fn resolve(path: &Path) -> String {
    let cwd = std::env::current_dir()
        .map(|d| d.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "/".into());
    node::posix_resolve(&cwd, &path.to_string_lossy())
}

fn report(theme: &[SourceCode], offenses: &[context::Offense]) -> Report {
    let files: HashMap<&str, &SourceCode> = theme.iter().map(|f| (f.uri.as_str(), f)).collect();
    let offenses = offenses
        .iter()
        .map(|o| {
            let file = files.get(o.uri.as_str());
            let at = |byte, fallback: source::Position| {
                let (line, column) = file
                    .map_or((fallback.line as usize, fallback.character as usize), |f| {
                        f.line_column(byte)
                    });
                Position { line, column }
            };
            Offense {
                check: o.check,
                path: path::fs_path(&o.uri).into(),
                message: o.message.clone(),
                severity: o.severity,
                range: o.start_byte..o.end_byte,
                start: at(o.start_byte, o.start),
                end: at(o.end_byte, o.end),
            }
        })
        .collect();
    Report {
        offenses,
        files: theme.iter().map(|f| path::fs_path(&f.uri).into()).collect(),
    }
}

/// The checks that come with Theme Check.
pub fn checks() -> impl Iterator<Item = &'static Check> {
    checks::ALL_CHECKS.iter().copied()
}

/// What checks like `UnknownFilter` check Liquid against: theme-liquid-docs' filters, objects,
/// tags and translations.
pub struct Docs(docset::ThemeDocset);

impl Docs {
    /// The docs from the text of theme-liquid-docs' `filters.json`, `objects.json`, `tags.json`
    /// and `shopify_system_translations.json`.
    pub fn from_json(
        filters: &str,
        objects: &str,
        tags: &str,
        system_translations: &str,
    ) -> Result<Self, Error> {
        let parse = |name: &str, json: &str| {
            serde_json::from_str::<Value>(json).map_err(|e| Error(format!("{name}: {e}")))
        };
        let list = |name: &str, json: &str| match parse(name, json)? {
            Value::Array(a) => Ok(a),
            _ => Err(Error(format!("{name}: not an array"))),
        };
        let Value::Object(translations) = parse("system_translations", system_translations)? else {
            return Err(Error("system_translations: not an object".into()));
        };
        Ok(Docs(docset::ThemeDocset::augmented(
            list("filters", filters)?,
            list("objects", objects)?,
            list("tags", tags)?,
            translations,
        )))
    }
}

/// Checks themes with the docs, schemas and checks you give it. Make one and run it on every
/// theme: it's `Sync`, so threads can share it.
///
/// By default, it runs the recommended checks, with the docs and schemas downloaded from
/// theme-liquid-docs (and cached). A theme's `.theme-check.yml` is only read by [`check`].
pub struct Checker {
    docs: Option<Docs>,
    schemas: Option<Vec<Schema>>,
    checks: Option<Vec<&'static Check>>,
    settings: Map<String, Value>,
    ignore: Vec<String>,
    threads: usize,
    downloaded: docs::ThemeLiquidDocsManager,
}

impl Default for Checker {
    fn default() -> Self {
        Self::new()
    }
}

impl Checker {
    pub fn new() -> Self {
        Checker {
            docs: None,
            schemas: None,
            checks: None,
            settings: Map::new(),
            ignore: Vec::new(),
            threads: 0,
            downloaded: docs::ThemeLiquidDocsManager::new(Box::new(|_| {})),
        }
    }

    /// The docs to check against, instead of downloading them.
    pub fn docs(mut self, docs: Docs) -> Self {
        self.docs = Some(docs);
        self
    }

    /// The schemas that JSON is validated with, instead of downloading them.
    pub fn schemas(mut self, schemas: Vec<Schema>) -> Self {
        self.schemas = Some(schemas);
        self
    }

    /// The checks to run, like [`checks`] and your own, instead of the recommended ones.
    pub fn checks(mut self, checks: impl IntoIterator<Item = &'static Check>) -> Self {
        self.checks = Some(checks.into_iter().collect());
        self
    }

    /// The checks' settings, by name, as in `.theme-check.yml`:
    /// `{"AssetSizeCSS": {"severity": "error", "threshold_in_bytes": 50000}}`. Without
    /// [`Self::checks`], they're merged into the recommended config, so a check with settings
    /// runs unless they say `"enabled": false`. With them, `"enabled": false` turns one off.
    pub fn settings(mut self, settings: Map<String, Value>) -> Self {
        self.settings = settings;
        self
    }

    /// The files to leave out, as in `.theme-check.yml`'s `ignore`: `_drafts/**` leaves out every
    /// `_drafts` folder, and a pattern that starts with `/` is from the root. They aren't read or
    /// checked, so lookups like block schemas don't find them.
    ///
    /// ```
    /// # use theme_check::{Checker, Docs, MemoryFs};
    /// let fs: MemoryFs = [
    ///     ("/theme/blocks/a.liquid", "{{ 'x' | nope }}"),
    ///     ("/theme/blocks/_drafts/a.liquid", "{{ 'x' | nope }}"),
    /// ]
    /// .into_iter()
    /// .collect();
    /// let report = Checker::new()
    /// #   .docs(Docs::from_json("[]", "[]", "[]", "{}")?)
    /// #   .schemas(Vec::new())
    ///     .ignore(["_drafts/**"])
    ///     .run(&fs, "/theme")?;
    /// assert_eq!(report.files, [std::path::PathBuf::from("/theme/blocks/a.liquid")]);
    /// # Ok::<(), theme_check::Error>(())
    /// ```
    pub fn ignore(mut self, patterns: impl IntoIterator<Item = impl Into<String>>) -> Self {
        self.ignore = patterns.into_iter().map(Into::into).collect();
        self
    }

    /// How many threads check the files. 0, the default, is one per core. With 1, they're checked
    /// on the calling thread. A check that panics panics on the calling thread either way.
    pub fn threads(mut self, threads: usize) -> Self {
        self.threads = threads;
        self
    }

    /// Checks the theme at `root` in `fs`: its `.liquid` and `.json` files, but not dot files,
    /// `node_modules`, which the recommended config ignores, or [`Self::ignore`]'s. It fails if
    /// `root` or a directory below it can't be listed, or a file can't be read.
    pub fn run(&self, fs: &dyn FileSystem, root: impl AsRef<Path>) -> Result<Report, Error> {
        let root = resolve(root.as_ref());
        let root_uri = path::file_uri(&root);
        let settings = node::config::resolve_check_settings(self.settings.clone())?;
        let recommended = node::config::recommended_with(settings.clone())?;
        let mut config = match &self.checks {
            None => recommended,
            Some(checks) => {
                let enabled = |c: &&Check| {
                    settings
                        .get(c.code)
                        .and_then(|s| s.get("enabled"))
                        .is_none_or(json::truthy)
                };
                Config::new(
                    checks.iter().copied().filter(enabled).collect(),
                    settings,
                    recommended.ignore,
                )
            }
        };
        config.ignore.extend(self.ignore.iter().cloned());

        let mut paths = Vec::new();
        fs::theme_files(fs, Path::new(&root), &mut paths).map_err(|e| Error(e.to_string()))?;
        let ignores = runner::ignore_patterns(&config, None, &root_uri);
        let mut paths: Vec<String> = paths
            .into_iter()
            .map(|p| p.to_string_lossy().into_owned())
            .filter(|p| !ignores.iter().any(|m| m.matches(p)))
            .collect();
        paths.sort_by(|a, b| node::locale_compare(a, b));
        let files = paths
            .iter()
            .map(|p| match fs.read_to_string(p.as_ref()) {
                Ok(source) => Ok((path::file_uri(p), source)),
                Err(e) => Err(Error(format!("{p}: {e}"))),
            })
            .collect::<Result<Vec<_>, _>>()?;
        let theme: Vec<SourceCode> = files.iter().map(|(u, s)| to_source_code(u, s)).collect();
        // ponytail: themes only. Theme app extensions need `Mode::App`, and its schemas and
        // checks; add a `Checker` setting for it when someone checks one.
        let schemas = match &self.schemas {
            Some(schemas) => schemas,
            None => self.downloaded.schemas(Mode::Theme),
        };
        let docset = match &self.docs {
            Some(docs) => &docs.0,
            None => self.downloaded.docset(),
        };
        let offenses = node::check_theme(
            &config,
            &theme,
            &root,
            &root_uri,
            Mode::Theme,
            &fs::Uris(fs),
            docset,
            schemas,
            self.threads,
        );
        Ok(report(&theme, &offenses))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use std::thread::ThreadId;

    static THREADS: Mutex<Vec<ThreadId>> = Mutex::new(Vec::new());

    struct RecordThread;

    impl<'a> LiquidCheck<'a> for RecordThread {
        fn start(&mut self, _: &mut Context<'a>) -> CheckResult {
            THREADS.lock().unwrap().push(std::thread::current().id());
            Ok(())
        }
    }

    struct Panic;

    impl<'a> LiquidCheck<'a> for Panic {
        fn start(&mut self, _: &mut Context<'a>) -> CheckResult {
            panic!("boom")
        }
    }

    const fn check(code: &'static str, create: Create) -> Check {
        Check {
            code,
            name: code,
            aliases: &[],
            severity: Severity::Error,
            recommended: false,
            deprecated: false,
            schema: &[],
            create,
        }
    }

    static RECORD_THREAD: Check = check(
        "RecordThread",
        Create::Liquid(|_| Some(Box::new(RecordThread))),
    );
    static PANIC: Check = check("Panic", Create::Liquid(|_| Some(Box::new(Panic))));

    fn checker(check: &'static Check) -> Checker {
        Checker::new()
            .docs(Docs::from_json("[]", "[]", "[]", "{}").unwrap())
            .schemas(Vec::new())
            .checks([check])
    }

    fn theme() -> MemoryFs {
        [
            ("/theme/snippets/a.liquid", ""),
            ("/theme/snippets/b.liquid", ""),
        ]
        .into_iter()
        .collect()
    }

    #[test]
    fn one_thread_is_the_calling_thread() {
        checker(&RECORD_THREAD)
            .threads(1)
            .run(&theme(), "/theme")
            .unwrap();
        assert_eq!(*THREADS.lock().unwrap(), [std::thread::current().id(); 2]);
    }

    #[test]
    fn a_panic_is_resumed_with_its_message() {
        for threads in [0, 1, 2] {
            let checker = checker(&PANIC).threads(threads);
            let fs = theme();
            let e = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                checker.run(&fs, "/theme")
            }))
            .unwrap_err();
            assert_eq!(e.downcast_ref::<&str>(), Some(&"boom"), "{threads} threads");
        }
    }
}
