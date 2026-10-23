//! Runs the language-neutral specs in specs/ at the repo root, as packages/theme-check-common
//! and packages/theme-graph do in TypeScript. Prints each failure, and fails when there's one.

use serde_json::{json, Map, Value};
use std::path::Path;
use theme_check::context::{FileStat, FileType, Providers, RecordedCall};
use theme_check::docset::ThemeDocset;
use theme_check::fixes::{self, Fix};
use theme_check::graph::{build_theme_graph, get_web_component_map, RefType};
use theme_check::json::js_insert;
use theme_check::source::{to_source_code, SourceCode};
use theme_check::{path, CheckDef, Config, Deps, FileSystem, Mode, Offense};

/// test/MockFileSystem.ts over `{ '.theme-check.yml': '', ...themeDesc }`, rooted at `file:///`.
struct MockFs {
    files: Map<String, Value>,
    /// Files are strings, directories objects (JS key order).
    tree: Value,
}

const ROOT: &str = "file:///";

impl MockFs {
    fn new(theme_desc: &Map<String, Value>) -> Self {
        let mut files = Map::new();
        files.insert(".theme-check.yml".into(), json!(""));
        for (k, v) in theme_desc {
            js_insert(&mut files, k.clone(), v.clone());
        }
        let mut tree = Value::Object(Map::new());
        for (rel, source) in &files {
            let segs: Vec<&str> = rel.split('/').collect();
            let mut cur = &mut tree;
            for seg in &segs[..segs.len() - 1] {
                let Value::Object(m) = cur else { break };
                if !m.contains_key(*seg) {
                    js_insert(m, seg.to_string(), Value::Object(Map::new()));
                }
                cur = m.get_mut(*seg).unwrap();
            }
            if let Value::Object(m) = cur {
                js_insert(m, segs[segs.len() - 1].to_string(), source.clone());
            }
        }
        MockFs { files, tree }
    }

    fn root_relative(uri: &str) -> String {
        path::relative(&path::normalize(uri), ROOT)
    }
}

impl FileSystem for MockFs {
    fn read_file(&self, uri: &str) -> Result<String, String> {
        match self.files.get(&Self::root_relative(uri)) {
            Some(Value::String(s)) => Ok(s.clone()),
            _ => Err("File not found".into()),
        }
    }

    fn read_directory(&self, uri: &str) -> Result<Vec<(String, FileType)>, String> {
        let uri = uri.strip_suffix('/').unwrap_or(uri);
        let tree = if path::normalize(uri) == ROOT {
            Some(&self.tree)
        } else {
            // deepGet(fileTree, relativePath.split('/'))
            Self::root_relative(uri)
                .split('/')
                .try_fold(&self.tree, |acc, k| acc.get(k))
        };
        match tree {
            None | Some(Value::Null) => Err(format!("Directory not found: {uri} for {ROOT}")),
            Some(Value::String(_)) => Ok(vec![(uri.to_string(), FileType::File)]),
            Some(Value::Object(m)) => Ok(m
                .iter()
                .map(|(name, v)| {
                    (
                        format!("{uri}/{name}"),
                        if v.is_string() {
                            FileType::File
                        } else {
                            FileType::Directory
                        },
                    )
                })
                .collect()),
            Some(_) => Ok(Vec::new()),
        }
    }

    fn stat(&self, uri: &str) -> Result<FileStat, String> {
        if let Some(Value::String(s)) = self.files.get(&Self::root_relative(uri)) {
            if !s.is_empty() {
                return Ok(FileStat {
                    file_type: FileType::File,
                    size: theme_check::js::len16(s),
                });
            }
        }
        self.read_directory(uri)?;
        Ok(FileStat {
            file_type: FileType::Directory,
            size: 0,
        })
    }
}

/// An offense as a spec states it: `check` when the case lists `checks`, `file`, `message`,
/// `start`, the `highlight` text from start to end, and the fixed file for `fix` and each `suggest`.
fn spec_offense(o: &Offense, theme: &[SourceCode], with_check: bool) -> Value {
    let file = theme
        .iter()
        .find(|f| f.uri == o.uri)
        .expect("offense on a file outside the theme");
    let apply = |fix: &Fix| match fixes::corrector_fix(file, [fix])
        .and_then(|edits| fixes::apply_fix_to_string(file.source, &edits))
    {
        Ok(fixed) => json!(fixed),
        Err(e) => json!({ "error": e }),
    };
    let mut m = Map::new();
    if with_check {
        m.insert("check".into(), json!(o.check));
    }
    m.insert("file".into(), json!(MockFs::root_relative(&o.uri)));
    m.insert("message".into(), json!(o.message));
    m.insert("start".into(), json!([o.start.line, o.start.character]));
    let end = o.end_byte.min(file.source.len());
    let highlight = file.source.get(o.start_byte.min(end)..end);
    m.insert(
        "highlight".into(),
        highlight.map_or_else(|| json!({ "error": "splits a character" }), |h| json!(h)),
    );
    if let Some(fix) = &o.fix {
        m.insert("fix".into(), apply(fix));
    }
    if let Some(suggest) = &o.suggest {
        m.insert(
            "suggest".into(),
            suggest
                .iter()
                .map(|s| json!({ "message": s.message, "result": apply(&s.fix) }))
                .collect(),
        );
    }
    Value::Object(m)
}

/// A file's content: a string, or parts to join, each a string or `{ repeat, times }`.
fn spec_text(text: &Value) -> String {
    if let Some(s) = text.as_str() {
        return s.to_string();
    }
    let parts = text
        .as_array()
        .expect("a file is a string or a list of parts");
    parts
        .iter()
        .map(|part| match part.as_str() {
            Some(s) => s.to_string(),
            None => part["repeat"]
                .as_str()
                .expect("a part is a string or { repeat, times }")
                .repeat(part["times"].as_u64().expect("times is a count") as usize),
        })
        .collect()
}

/// The spec files in `dir`, parsed, by file name.
fn spec_files(dir: &Path) -> Vec<(String, Value)> {
    let mut paths: Vec<_> = std::fs::read_dir(dir)
        .unwrap_or_else(|e| panic!("{}: {e}", dir.display()))
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|x| x == "yml"))
        .collect();
    paths.sort();
    paths
        .iter()
        .map(|p| {
            let spec = theme_check::yaml::parse(&std::fs::read_to_string(p).unwrap())
                .unwrap_or_else(|e| panic!("{}: {e:?}", p.display()));
            (p.file_name().unwrap().to_string_lossy().into_owned(), spec)
        })
        .collect()
}

/// Unordered: drops each expected item from the actual ones. What's left of each is missing and
/// unexpected.
fn unordered_diff(expected: Vec<Value>, mut unexpected: Vec<Value>) -> (Vec<Value>, Vec<Value>) {
    let missing = expected
        .into_iter()
        .filter(|e| {
            unexpected
                .iter()
                .position(|a| a == e)
                .map(|i| unexpected.remove(i))
                .is_none()
        })
        .collect();
    (missing, unexpected)
}

fn mode(case: &Value) -> Mode {
    match case["mode"].as_str() {
        None | Some("theme") => Mode::Theme,
        Some("app") => Mode::App,
        Some(other) => panic!("unknown mode {other}"),
    }
}

/// specs/checks/*.yml, format in its README.md. Returns the number of specs and of failures.
fn run_check_specs(dir: &Path) -> (usize, usize) {
    let (mut total, mut failed) = (0, 0);
    for (spec_file, spec) in spec_files(dir) {
        let code = spec["check"].as_str().unwrap_or_default();
        let defs: Vec<&'static CheckDef> = theme_check::checks::ALL_CHECKS
            .iter()
            .copied()
            .filter(|d| d.code == code)
            .collect();
        let severity = ["error", "warning", "info"]
            .iter()
            .position(|s| spec["severity"] == *s);
        // Without `check`, a spec tests a feature, and each case lists its `checks`.
        if spec.get("check").is_some() {
            total += 1;
            if defs.is_empty() || defs.iter().any(|d| Some(d.severity as usize) != severity) {
                failed += 1;
                println!(
                    "FAIL checks/{spec_file}: {code} isn't ported or doesn't have severity {}",
                    spec["severity"]
                );
                continue;
            }
        }
        for case in spec["cases"].as_array().into_iter().flatten() {
            total += 1;
            // A file at a URL is a remote file: the check only ever sees its size.
            let is_remote =
                |file: &str| file.starts_with("http://") || file.starts_with("https://");
            let (remote, files): (Map<String, Value>, Map<String, Value>) = case["files"]
                .as_object()
                .expect("a case needs files")
                .iter()
                .map(|(rel, text)| (rel.clone(), json!(spec_text(text))))
                .partition(|(file, _)| is_remote(file));
            let fs = MockFs::new(&files);
            let sources: Vec<(String, &str)> = files
                .iter()
                .map(|(rel, src)| (path::join(ROOT, &[rel]), src.as_str().unwrap()))
                .collect();
            let theme: Vec<_> = sources
                .iter()
                .map(|(uri, src)| to_source_code(uri, src))
                .collect();
            let docset = case.get("docset").map(|d| {
                // A name is a file in docsets/.
                let named = d.as_str().map(|name| {
                    let file = dir.join("docsets").join(format!("{name}.yml"));
                    theme_check::yaml::parse(
                        &std::fs::read_to_string(&file)
                            .unwrap_or_else(|e| panic!("{}: {e}", file.display())),
                    )
                    .expect("bad docset YAML")
                });
                let d = named.as_ref().unwrap_or(d);
                let list = |k: &str| d[k].as_array().cloned().unwrap_or_default();
                ThemeDocset::augmented(
                    list("filters"),
                    list("objects"),
                    list("tags"),
                    d["systemTranslations"]
                        .as_object()
                        .cloned()
                        .unwrap_or_default(),
                )
            });
            let mut problems = Vec::new();
            let with_check = case["checks"].is_array();
            let defs: Vec<&'static CheckDef> = match case["checks"].as_array() {
                Some(codes) => {
                    let codes: Vec<&str> = codes
                        .iter()
                        .map(|c| c.as_str().expect("a check is its code"))
                        .collect();
                    problems.extend(
                        codes
                            .iter()
                            .filter(|c| {
                                !theme_check::checks::ALL_CHECKS
                                    .iter()
                                    .any(|d| d.code == **c)
                            })
                            .map(|c| format!("unknown check {c}")),
                    );
                    theme_check::checks::ALL_CHECKS
                        .iter()
                        .copied()
                        .filter(|d| codes.contains(&d.code))
                        .collect()
                }
                None => defs.clone(),
            };
            if defs.is_empty() {
                problems.push("no checks to run".to_string());
            }
            // An option the check doesn't have would be silently ignored.
            for (code, options) in case["config"].as_object().into_iter().flatten() {
                let def = defs.iter().find(|d| d.code == code);
                for key in options.as_object().into_iter().flatten().map(|(k, _)| k) {
                    if !def.is_some_and(|d| d.schema.iter().any(|(k, _)| k == key)) {
                        problems.push(format!("unknown config option {code}.{key}"));
                    }
                }
            }
            let config = Config::new(
                defs.clone(),
                case["config"].as_object().cloned().unwrap_or_default(),
                Vec::new(),
            );
            let mut deps = Deps::new(
                &theme,
                ROOT,
                mode(case),
                &fs,
                docset,
                Providers {
                    theme_schemas: true,
                },
            );
            // Which files render which, as production gets it from the theme graph.
            let mut edges = Vec::new();
            for r in case["references"].as_array().into_iter().flatten() {
                let ref_type = r
                    .get("type")
                    .map_or("direct", |t| t.as_str().unwrap_or_default());
                if !["direct", "indirect", "preset"].contains(&ref_type) {
                    problems.push(format!("unknown reference type {ref_type}"));
                }
                let mut uri = |end: &str| {
                    let rel = r[end].as_str().unwrap_or_default();
                    if !files.contains_key(rel) {
                        problems.push(format!("reference {end} {rel} isn't in files"));
                    }
                    json!({ "uri": path::join(ROOT, &[rel]) })
                };
                edges.push(
                    json!({ "source": uri("source"), "target": uri("target"), "type": ref_type }),
                );
            }
            let answers = |dep: &str, end: &str| -> Vec<RecordedCall> {
                edges
                    .iter()
                    .map(|e| RecordedCall {
                        dep: dep.into(),
                        method: None,
                        args: json!([e[end]["uri"]]),
                        result: Ok(edges
                            .iter()
                            .filter(|other| other[end] == e[end])
                            .cloned()
                            .collect()),
                    })
                    .collect()
            };
            deps.recorded = answers("getReferences", "target");
            deps.recorded.extend(answers("getDependencies", "source"));
            deps.recorded
                .extend(remote.iter().map(|(url, text)| RecordedCall {
                    dep: "remoteFileSize".into(),
                    method: None,
                    args: json!([url]),
                    result: Ok(json!(text.as_str().unwrap().len())),
                }));
            deps.mocked = vec![
                "getReferences".into(),
                "getDependencies".into(),
                "remoteFileSize".into(),
            ];
            let out = theme_check::check(&config, &deps, 1);

            let mut expected = case["offenses"].as_array().cloned().unwrap_or_default();
            for e in &mut expected {
                e["highlight"] = json!(spec_text(&e["highlight"]));
            }
            let actual = out
                .offenses
                .iter()
                .map(|o| spec_offense(o, &theme, with_check))
                .collect();
            let (missing, unexpected) = unordered_diff(expected, actual);
            // Each file with several fixes, after applying them all at once.
            let autofix: Map<String, Value> = theme
                .iter()
                .filter_map(|file| {
                    let fixes: Vec<&Fix> = out
                        .offenses
                        .iter()
                        .filter(|o| o.uri == file.uri)
                        .filter_map(|o| o.fix.as_ref())
                        .collect();
                    (fixes.len() > 1).then(|| {
                        let fixed = fixes::corrector_fix(file, fixes)
                            .and_then(|edits| fixes::apply_fix_to_string(file.source, &edits));
                        (
                            MockFs::root_relative(&file.uri),
                            fixed.map_or_else(|e| json!({ "error": e }), Value::String),
                        )
                    })
                })
                .collect();
            let expected_autofix = case["autofix"].as_object().cloned().unwrap_or_default();
            if autofix != expected_autofix {
                problems.push(format!(
                    "autofix: expected {}, got {}",
                    Value::Object(expected_autofix),
                    Value::Object(autofix)
                ));
            }
            if missing.is_empty()
                && unexpected.is_empty()
                && out.errors.is_empty()
                && problems.is_empty()
            {
                continue;
            }
            failed += 1;
            println!(
                "FAIL checks/{spec_file}: {}",
                case["name"].as_str().unwrap_or("?")
            );
            missing.iter().for_each(|o| println!("  - {o}"));
            unexpected.iter().for_each(|o| println!("  + {o}"));
            out.errors
                .iter()
                .for_each(|e| println!("  ! {} threw: {}", e.check, e.message));
            problems.iter().for_each(|k| println!("  ! {k}"));
        }
    }
    (total, failed)
}

const GRAPH_CASE_KEYS: &[&str] = &["name", "mode", "files", "entryPoints", "modules", "edges"];

/// specs/graph/*.yml, format in its README.md. Returns the number of cases and of failures.
fn run_graph_specs(dir: &Path) -> (usize, usize) {
    let (mut total, mut failed) = (0, 0);
    for (spec_file, spec) in spec_files(dir) {
        for case in spec["cases"].as_array().into_iter().flatten() {
            total += 1;
            let files: Map<String, Value> = case["files"]
                .as_object()
                .expect("a case needs files")
                .clone();
            // A misspelled optional key would silently check nothing.
            let mut problems: Vec<String> = case
                .as_object()
                .into_iter()
                .flatten()
                .map(|(k, _)| k)
                .filter(|k| !GRAPH_CASE_KEYS.contains(&k.as_str()))
                .map(|k| format!("unknown case key {k}"))
                .collect();
            let fs = MockFs::new(&files);
            let sources: Vec<(String, &str)> = files
                .iter()
                .filter(|(rel, _)| rel.ends_with(".liquid") || rel.ends_with(".json"))
                .map(|(rel, src)| {
                    (
                        path::join(ROOT, &[rel]),
                        src.as_str().expect("a file is a string"),
                    )
                })
                .collect();
            let theme: Vec<_> = sources
                .iter()
                .map(|(uri, src)| to_source_code(uri, src))
                .collect();
            let deps = Deps::new(
                &theme,
                ROOT,
                mode(case),
                &fs,
                None,
                Providers {
                    theme_schemas: true,
                },
            );
            let web_components = get_web_component_map(ROOT, &fs)
                .unwrap_or_else(|e| panic!("getWebComponentMap threw: {e}"));
            let graph = build_theme_graph(&deps, &|name| web_components.get(name).cloned(), None);
            let (mut missing, mut unexpected) = (Vec::new(), Vec::new());
            match &graph {
                Err(e) => problems.push(format!("buildThemeGraph threw: {e}")),
                Ok(graph) => {
                    // The [line, character] of a UTF-16 range's start in its file, and its text.
                    let at = |uri: &str, (start, end): (usize, usize)| {
                        let units: Vec<u16> = files[&MockFs::root_relative(uri)]
                            .as_str()
                            .unwrap()
                            .encode_utf16()
                            .collect();
                        let before = &units[..start.min(units.len())];
                        let line_start = before
                            .iter()
                            .rposition(|&u| u == u16::from(b'\n'))
                            .map_or(0, |i| i + 1);
                        let line = before.iter().filter(|&&u| u == u16::from(b'\n')).count();
                        (
                            json!([line, start - line_start]),
                            json!(units.get(start..end).map(String::from_utf16_lossy)),
                        )
                    };
                    let edges = graph
                        .modules()
                        .flat_map(|m| &m.dependencies)
                        .map(|r| {
                            let mut e = Map::new();
                            e.insert("source".into(), json!(MockFs::root_relative(&r.source.uri)));
                            if let Some(range) = r.source.range {
                                let (start, text) = at(&r.source.uri, range);
                                e.insert("start".into(), start);
                                e.insert("text".into(), text);
                            }
                            e.insert("target".into(), json!(MockFs::root_relative(&r.target.uri)));
                            if let Some(range) = r.target.range {
                                let (start, text) = at(&r.target.uri, range);
                                e.insert("targetStart".into(), start);
                                e.insert("targetText".into(), text);
                            }
                            if r.ref_type != RefType::Direct {
                                e.insert("type".into(), json!(r.ref_type.as_str()));
                            }
                            Value::Object(e)
                        })
                        .collect();
                    (missing, unexpected) = unordered_diff(
                        case["edges"].as_array().cloned().unwrap_or_default(),
                        edges,
                    );
                    if let Some(expected) = case.get("entryPoints") {
                        let actual = graph
                            .entry_points()
                            .map(|m| json!(MockFs::root_relative(&m.uri)))
                            .collect();
                        let (m, u) = unordered_diff(
                            expected.as_array().cloned().unwrap_or_default(),
                            actual,
                        );
                        problems.extend(
                            m.iter()
                                .map(|e| format!("missing entry point {e}"))
                                .chain(u.iter().map(|e| format!("unexpected entry point {e}"))),
                        );
                    }
                    if let Some(expected) = case.get("modules") {
                        let actual = graph
                            .modules()
                            .map(|m| {
                                let mut module = json!({ "file": MockFs::root_relative(&m.uri), "type": m.module_type.as_str(), "kind": m.kind.as_str() });
                                if m.exists == Some(false) {
                                    module["exists"] = json!(false);
                                }
                                module
                            })
                            .collect();
                        let (m, u) = unordered_diff(
                            expected.as_array().cloned().unwrap_or_default(),
                            actual,
                        );
                        problems.extend(
                            m.iter()
                                .map(|e| format!("missing module {e}"))
                                .chain(u.iter().map(|e| format!("unexpected module {e}"))),
                        );
                    }
                }
            }
            if missing.is_empty() && unexpected.is_empty() && problems.is_empty() {
                continue;
            }
            failed += 1;
            println!(
                "FAIL graph/{spec_file}: {}",
                case["name"].as_str().unwrap_or("?")
            );
            missing.iter().for_each(|e| println!("  - {e}"));
            unexpected.iter().for_each(|e| println!("  + {e}"));
            problems.iter().for_each(|p| println!("  ! {p}"));
        }
    }
    (total, failed)
}

fn main() {
    let specs = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../specs");
    let (checks, checks_failed) = run_check_specs(&specs.join("checks"));
    println!(
        "specs/checks: {} of {checks} passing",
        checks - checks_failed
    );
    let (graph, graph_failed) = run_graph_specs(&specs.join("graph"));
    println!("specs/graph: {} of {graph} passing", graph - graph_failed);
    std::process::exit(i32::from(checks_failed + graph_failed > 0));
}
