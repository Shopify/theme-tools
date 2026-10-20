//! theme-check-node `index.ts`: `getTheme`, `toSourceCode`, `themeCheckRun` and
//! `checkAndAutofix`, plus the JS conventions the `theme-check` CLI prints with (thrown errors,
//! `JSON.stringify(x, null, 2)`).

pub mod config;

use crate::checks::ALL_CHECKS;
use crate::context::{Providers, SourceKind};
use crate::docs::{Logger, ThemeLiquidDocsManager};
use crate::json::js_number_to_string;
use crate::json_validator::JsonValidator;
use crate::node_fs::NodeFileSystem;
use crate::path::{self, posix_normalize};
use crate::runner::ignore_patterns;
use crate::source::{to_source_code, Position, SourceCode};
use crate::{CheckDef, Config, Deps, FileSystem, Mode, Offense};
use config::{check_metas, load_config, NodeConfig};
use serde_json::{json, Value};
use std::cmp::Ordering;
use std::collections::HashSet;
use std::fmt;

/// A thrown JS error. Displays as Node prints an uncaught one, minus the stack.
#[derive(Clone, Debug, PartialEq)]
pub struct JsError {
    pub name: String,
    pub message: String,
}

impl JsError {
    pub fn new(name: impl Into<String>, message: impl Into<String>) -> Self {
        JsError {
            name: name.into(),
            message: message.into(),
        }
    }
    pub fn error(message: impl Into<String>) -> Self {
        Self::new("Error", message)
    }
    pub fn assertion(message: impl Into<String>) -> Self {
        Self::new("AssertionError [ERR_ASSERTION]", message)
    }
}

impl fmt::Display for JsError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}: {}", self.name, self.message)
    }
}

impl std::error::Error for JsError {}

/// The error Node's fs throws: `ENOENT: no such file or directory, open '/x'`.
pub(crate) fn fs_error(e: &std::io::Error, syscall: &str, path: &str) -> JsError {
    use std::io::ErrorKind::*;
    let (code, desc) = match e.kind() {
        NotFound => ("ENOENT", "no such file or directory"),
        PermissionDenied if e.raw_os_error() == Some(1) => ("EPERM", "operation not permitted"),
        PermissionDenied => ("EACCES", "permission denied"),
        NotADirectory => ("ENOTDIR", "not a directory"),
        // A directory opens fine; reading it fails, without a path.
        IsADirectory => return JsError::error("EISDIR: illegal operation on a directory, read"),
        // ponytail: other errnos get Rust's description.
        _ => return JsError::error(format!("{e}, {syscall} '{path}'")),
    };
    JsError::error(format!("{code}: {desc}, {syscall} '{path}'"))
}

/// Node `path.join(a, b)` (posix).
pub(crate) fn posix_join(a: &str, b: &str) -> String {
    match (a.is_empty(), b.is_empty()) {
        (true, _) => posix_normalize(b),
        (_, true) => posix_normalize(a),
        _ => posix_normalize(&format!("{a}/{b}")),
    }
}

/// Node `path.resolve(base, p)` (posix) for an absolute `base`.
pub fn posix_resolve(base: &str, p: &str) -> String {
    let n = posix_normalize(&if p.starts_with('/') {
        p.to_string()
    } else {
        format!("{base}/{p}")
    });
    match n.strip_suffix('/') {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => n,
    }
}

/// Node `path.relative(from, to)` (posix) for absolute paths.
fn posix_relative(from: &str, to: &str) -> String {
    let (from, to) = (posix_resolve("/", from), posix_resolve("/", to));
    if from == to {
        return String::new();
    }
    // Without the leading `/`.
    let (f, t) = (&from.as_bytes()[1..], &to.as_bytes()[1..]);
    let length = f.len().min(t.len());
    let mut last_common_sep: isize = -1;
    let mut i = 0;
    while i < length && f[i] == t[i] {
        if f[i] == b'/' {
            last_common_sep = i as isize;
        }
        i += 1;
    }
    if i == length {
        if t.len() > length {
            if t[i] == b'/' {
                return to[1 + i + 1..].to_string();
            }
            if i == 0 {
                return to[1..].to_string();
            }
        } else if f.len() > length {
            if f[i] == b'/' {
                last_common_sep = i as isize;
            } else if i == 0 {
                last_common_sep = 0;
            }
        }
    }
    let mut out = String::new();
    for j in (last_common_sep + 1) as usize..=f.len() {
        if j == f.len() || f[j] == b'/' {
            out.push_str(if out.is_empty() { ".." } else { "/.." });
        }
    }
    out + &to[(1 + last_common_sep) as usize..]
}

/// `URI.file(fsPath).toString()`: all but `[A-Za-z0-9-._~/]` percent-encoded.
fn encoded_file_uri(fs_path: &str) -> String {
    let mut out = String::from("file://");
    for b in fs_path.bytes() {
        if b.is_ascii_alphanumeric() || b"-._~/".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

// ---------------------------------------------------------------------------------------------
// getTheme

/// `a.localeCompare(b, 'en')` (ICU root collation), as glob@8 sorts its results. Checked against
/// Node on random ASCII strings. ponytail: non-ASCII sorts after ASCII by code point, where ICU
/// interleaves accented letters with their base letters.
fn locale_compare(a: &str, b: &str) -> Ordering {
    // Primary weights by ASCII code; 0 is ignorable (controls other than \t..\r).
    #[rustfmt::skip]
    const RANK: [u8; 128] = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        6, 12, 16, 28, 38, 29, 27, 15, 17, 18, 24, 32, 9, 8, 14, 25, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 11, 10, 33, 34, 35, 13,
        23, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 19, 26, 20, 31, 7,
        30, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 21, 36, 22, 37, 0,
    ];
    let weighted = |s: &'_ str| {
        s.chars()
            .map(|c| {
                (
                    if c.is_ascii() {
                        RANK[c as usize] as u32
                    } else {
                        1000 + c as u32
                    },
                    c.is_ascii_uppercase(),
                )
            })
            .filter(|(w, _)| *w != 0)
            .collect::<Vec<_>>()
    };
    let (wa, wb) = (weighted(a), weighted(b));
    // Primary weights first, then case (tertiary): lowercase before uppercase.
    wa.iter()
        .map(|w| w.0)
        .cmp(wb.iter().map(|w| w.0))
        .then_with(|| wa.iter().map(|w| w.1).cmp(wb.iter().map(|w| w.1)))
}

/// glob@8's `**/*.{liquid,json}` below `dir`: dot entries are skipped, and symlinked directories
/// are listed but not crawled (`crawl: false`). The root itself is crawled even if it's a link.
/// ponytail: unreadable directories are skipped silently; glob@8 also logs `glob error` for EACCES.
fn glob_theme_files(dir: &str, crawl: bool, out: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut subdirs = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let p = if dir == "/" {
            format!("/{name}")
        } else {
            format!("{dir}/{name}")
        };
        if name.ends_with(".liquid") || name.ends_with(".json") {
            out.push(p.clone());
        }
        if crawl {
            match entry.file_type() {
                Ok(t) if t.is_dir() => subdirs.push((p, true)),
                Ok(t) if t.is_symlink() => subdirs.push((p, false)),
                _ => {}
            }
        }
    }
    for (d, crawl) in subdirs {
        glob_theme_files(&d, crawl, out);
    }
}

/// `getTheme(config)`: the `(uri, source)` of every theme file, in glob order. `core` is the
/// same config, for `isIgnored`. ponytail: glob magic characters in the root path are taken
/// literally, where glob@8 would expand them.
pub fn get_theme(config: &NodeConfig, core: &Config) -> Result<Vec<(String, String)>, JsError> {
    let root = posix_resolve("/", &path::fs_path(&config.root_uri));
    let mut paths = Vec::new();
    glob_theme_files(&root, true, &mut paths);
    paths.sort_by(|a, b| locale_compare(a, b));
    if !paths.is_empty() {
        // `pattern.replace(...)` on every global ignore entry, for each file.
        match config.ignore.iter().find(|p| !p.is_string()) {
            Some(Value::Null) => {
                return Err(JsError::new(
                    "TypeError",
                    "Cannot read properties of null (reading 'replace')",
                ))
            }
            Some(_) => {
                return Err(JsError::new(
                    "TypeError",
                    "pattern.replace is not a function",
                ))
            }
            None => {}
        }
    }
    // `isIgnored(filePath, config)` on fs paths: patterns made absolute with the root *uri*
    // never match.
    let ignores = ignore_patterns(core, None, &config.root_uri);
    Ok(paths
        .into_iter()
        .filter(|p| !ignores.iter().any(|m| m.matches(p)))
        // `toSourceCode(absolutePath)`: unreadable files are dropped.
        .filter_map(|p| {
            std::fs::read(&p)
                .ok()
                .map(|b| (path::file_uri(&p), String::from_utf8_lossy(&b).into_owned()))
        })
        .collect())
}

// ---------------------------------------------------------------------------------------------
// themeCheckRun

/// `ThemeCheckRun`, with the theme as its uris.
pub struct ThemeCheckRun {
    pub config: NodeConfig,
    pub theme: Vec<String>,
    pub offenses: Vec<Offense>,
}

/// The Rust check for a TS meta (same code and source type). The checks that aren't ported are
/// reported on stderr and skipped.
fn check_def(meta: &Value) -> Option<&'static CheckDef> {
    let code = meta["code"].as_str().unwrap_or_default();
    let kind = if meta["type"] == "JSON" {
        SourceKind::Json
    } else {
        SourceKind::LiquidHtml
    };
    let def = ALL_CHECKS
        .iter()
        .copied()
        .find(|d| d.code == code && d.kind() == kind);
    if def.is_none() {
        eprintln!(
            "theme-check: {code} ({}) is not ported to Rust yet; skipping it",
            meta["type"].as_str().unwrap_or_default()
        );
    }
    def
}

/// `themeCheckRun(root, configPath, log)`
pub fn theme_check_run(
    root: &str,
    config_path: Option<&str>,
    log: Logger,
) -> Result<ThemeCheckRun, JsError> {
    run(root, config_path, log, |_, _| ()).map(|(run, ())| run)
}

/// `checkAndAutofix(root, configPath)`: writes the safe fixes to disk.
pub fn check_and_autofix(root: &str, config_path: Option<&str>) -> Result<(), JsError> {
    let (_, result) = run(
        root,
        config_path,
        Box::new(|_| {}),
        |_theme, _offenses| -> Result<(), JsError> {
            // theme-check-node's `autofix(theme, offenses)`: core `autofix` with
            // `saveToDiskFixApplicator`. Every file is written, then the first failure is thrown.
            let mut first_error = None;
            for (uri, fixed) in crate::fixes::autofix(_theme, _offenses) {
                let fs_path = path::fs_path(&uri);
                let written = fixed.map_err(JsError::error).and_then(|s| {
                    std::fs::write(&fs_path, s).map_err(|e| fs_error(&e, "open", &fs_path))
                });
                if let Err(e) = written {
                    first_error.get_or_insert(e);
                }
            }
            first_error.map_or(Ok(()), Err)
        },
    )?;
    result
}

/// On a thread of its own, as it parses: see [`crate::runner::STACK_SIZE`].
fn run<R: Send>(
    root: &str,
    config_path: Option<&str>,
    log: Logger,
    after: impl FnOnce(&[SourceCode], &[Offense]) -> R + Send,
) -> Result<(ThemeCheckRun, R), JsError> {
    std::thread::scope(|s| {
        std::thread::Builder::new()
            .stack_size(crate::runner::STACK_SIZE)
            .spawn_scoped(s, || run_here(root, config_path, log, after))
            .expect("spawn theme-check thread")
            .join()
            .unwrap_or_else(|e| std::panic::resume_unwind(e))
    })
}

fn run_here<R>(
    root: &str,
    config_path: Option<&str>,
    log: Logger,
    after: impl FnOnce(&[SourceCode], &[Offense]) -> R,
) -> Result<(ThemeCheckRun, R), JsError> {
    let config = load_config(config_path, root)?;
    let metas = check_metas();
    let defs = config
        .checks
        .iter()
        .filter_map(|&i| check_def(&metas[i]))
        .collect();
    let ignore = config
        .ignore
        .iter()
        .filter_map(|p| p.as_str().map(String::from))
        .collect();
    let core = Config::new(defs, config.settings.clone(), ignore);
    let files = get_theme(&config, &core)?;
    let theme: Vec<SourceCode> = files
        .iter()
        .map(|(uri, source)| to_source_code(uri, source))
        .collect();

    let mut docs = ThemeLiquidDocsManager::new(log);
    let mode = if config.context == "app" {
        Mode::App
    } else {
        Mode::Theme
    };
    let fs = NodeFileSystem;
    // `JSONValidator.create(themeLiquidDocsManager, config)`, whose `isValid` the schema getters
    // use, and the one `check()` makes again for `validateJSON`. Two instances, as in TS: schema
    // resolution state is per validator.
    let schema_validator = JsonValidator::new(docs.schemas(mode));
    let json_validator = JsonValidator::new(docs.schemas(mode));
    let mut deps = Deps::new(
        &theme,
        &config.root_uri,
        mode,
        &fs,
        Some(docs.take_docset()),
        Providers {
            theme_schemas: true,
        },
    );
    deps.schema_validator = Some(schema_validator);
    deps.json_validator = Some(json_validator);
    let root_key = format!("/{}", encoded_file_uri(root));
    deps.doc_definition_keys = Some(
        theme
            .iter()
            .enumerate()
            .map(|(i, f)| (posix_relative(&root_key, &format!("/{}", f.uri)), i))
            .collect(),
    );
    let mut css_class_uris: HashSet<String> = theme
        .iter()
        .filter(|f| f.uri.ends_with(".liquid"))
        .map(|f| f.uri.clone())
        .collect();
    if let Ok(assets) = fs.read_directory(&path::join(&config.root_uri, &["assets"])) {
        css_class_uris.extend(
            assets
                .into_iter()
                .map(|(uri, _)| uri)
                .filter(|uri| uri.ends_with(".css")),
        );
    }
    deps.css_class_uris = Some(css_class_uris);
    // `buildThemeGraph(config.rootUri, ...)` with these schema getters, mode and
    // `getWebComponentDefinitionReference: () => undefined`. `getReferences` and
    // `getDependencies` answer `[]` when it fails. (`getAppBlockSchema` is `Deps::get_app_block_schema`.)
    deps.theme_graph = Some(crate::graph::build_theme_graph(&deps, &|_| None, None));

    let offenses = crate::check(&core, &deps, 0).offenses;
    let result = after(&theme, &offenses);
    let theme = theme.iter().map(|f| f.uri.clone()).collect();
    Ok((
        ThemeCheckRun {
            config,
            theme,
            offenses,
        },
        result,
    ))
}

// ---------------------------------------------------------------------------------------------
// Output

/// `JSON.stringify(value, null, 2)`
pub fn stringify(value: &Value) -> String {
    fn write(v: &Value, indent: usize, out: &mut String) {
        let pad = |out: &mut String, n: usize| out.extend(std::iter::repeat(' ').take(n));
        match v {
            Value::Number(n) if n.is_f64() => {
                out.push_str(&js_number_to_string(n.as_f64().unwrap_or_default()))
            }
            Value::Array(a) if !a.is_empty() => {
                out.push('[');
                for (i, item) in a.iter().enumerate() {
                    out.push_str(if i == 0 { "\n" } else { ",\n" });
                    pad(out, indent + 2);
                    write(item, indent + 2, out);
                }
                out.push('\n');
                pad(out, indent);
                out.push(']');
            }
            Value::Object(m) if !m.is_empty() => {
                out.push('{');
                for (i, (k, item)) in m.iter().enumerate() {
                    out.push_str(if i == 0 { "\n" } else { ",\n" });
                    pad(out, indent + 2);
                    out.push_str(&Value::String(k.clone()).to_string());
                    out.push_str(": ");
                    write(item, indent + 2, out);
                }
                out.push('\n');
                pad(out, indent);
                out.push('}');
            }
            v => out.push_str(&v.to_string()),
        }
    }
    let mut out = String::new();
    write(value, 0, &mut out);
    out
}

fn position(p: Position) -> Value {
    json!({ "index": p.index, "line": p.line, "character": p.character })
}

/// An `Offense` as `JSON.stringify` sees it (`fix` is a function).
pub fn offense_json(o: &Offense) -> Value {
    let kind = match o.kind {
        SourceKind::LiquidHtml => "LiquidHtml",
        SourceKind::Json => "JSON",
    };
    let mut out = json!({
        "type": kind,
        "check": o.check,
        "message": o.message,
        "uri": o.uri,
        "severity": o.severity as u8,
        "start": position(o.start),
        "end": position(o.end),
    });
    // `suggest` serializes as `[{ "message": ... }]` (each `fix` is a function).
    if let Some(suggest) = &o.suggest {
        out["suggest"] = suggest
            .iter()
            .map(|s| json!({ "message": s.message }))
            .collect();
    }
    out
}

/// A `Config` as `JSON.stringify` sees it (checks are `{ meta }`: `create` is a function).
pub fn config_json(c: &NodeConfig) -> Value {
    let metas = check_metas();
    json!({
        "settings": c.settings,
        "context": c.context,
        "checks": c.checks.iter().map(|&i| json!({ "meta": metas[i] })).collect::<Vec<_>>(),
        "ignore": c.ignore,
        "rootUri": c.root_uri,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_defs_match_ts_metas() {
        let metas = check_metas();
        assert_eq!(metas.len(), ALL_CHECKS.len());
        let drifts: Vec<_> = metas
            .iter()
            .filter_map(|meta| {
                let def = check_def(meta).expect("a Rust check for each TS check");
                let targets = meta["targets"].as_array().map_or(&[][..], Vec::as_slice);
                let ts = json!({
                    "name": meta["name"],
                    "aliases": meta.get("aliases").unwrap_or(&json!([])),
                    "severity": meta["severity"],
                    "recommended": meta["docs"]["recommended"] == true
                        && (targets.is_empty() || targets.contains(&json!("recommended"))),
                    "deprecated": meta["deprecated"] == true,
                    "schema": meta["schema"].as_object().unwrap().iter()
                        .map(|(k, v)| (k.clone(), v["options"]["defaultValue"].clone()))
                        .collect::<serde_json::Map<_, _>>(),
                });
                let rs = json!({
                    "name": def.name,
                    "aliases": def.aliases,
                    "severity": def.severity as u8,
                    "recommended": def.recommended,
                    "deprecated": def.deprecated,
                    "schema": def.schema.iter()
                        .map(|(k, v)| (k.to_string(), serde_json::from_str::<Value>(v).unwrap()))
                        .collect::<serde_json::Map<_, _>>(),
                });
                (rs != ts).then(|| format!("{}\n  TS {ts}\n  RS {rs}", def.code))
            })
            .collect();
        assert!(drifts.is_empty(), "{}", drifts.join("\n"));
    }

    #[test]
    fn node_conventions() {
        // Expected values from Node 24.
        assert_eq!(
            posix_relative("/file:/a/b", "/file:/a/b/snippets/x.liquid"),
            "snippets/x.liquid"
        );
        assert_eq!(
            posix_relative("/file:/a%20b", "/file:/a b/snippets/x.liquid"),
            "../a b/snippets/x.liquid"
        );
        assert_eq!(posix_relative("/a/b", "/a"), "..");
        assert_eq!(posix_relative("/a/bc", "/a/b"), "../b");
        assert_eq!(posix_relative("/", "/a"), "a");
        assert_eq!(posix_resolve("/x/y", "../z/"), "/x/z");
        assert_eq!(posix_join("/x", ".theme-check.yml"), "/x/.theme-check.yml");
        assert_eq!(
            encoded_file_uri("/a b/(c)~é"),
            "file:///a%20b/%28c%29~%C3%A9"
        );
        let mut v = vec![
            "b", "B", "a_", "a-", "a", "A", "a.b", "a/b", "_", "1", "a\u{1}b", "ab",
        ];
        v.sort_by(|a, b| locale_compare(a, b));
        assert_eq!(
            v,
            ["_", "1", "a", "A", "a_", "a-", "a.b", "a/b", "a\u{1}b", "ab", "b", "B"]
        );
        let v = json!({"a": [1, 1.5, 1e21, [], {}, {"b": "\u{1}\""}], "c": null});
        assert_eq!(stringify(&v), "{\n  \"a\": [\n    1,\n    1.5,\n    1e+21,\n    [],\n    {},\n    {\n      \"b\": \"\\u0001\\\"\"\n    }\n  ],\n  \"c\": null\n}");
    }
}
