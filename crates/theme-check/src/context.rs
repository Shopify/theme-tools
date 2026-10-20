//! The check API: `CheckDef`, the check traits, `Context` (what `create()` and check methods get)
//! and `Deps` (theme-wide dependencies, shared by all files and safe to share across threads).

use crate::block_parameters::{resolve_block_parameters, BlockParameters};
use crate::docset::ThemeDocset;
use crate::fixes::{Fix, Suggestion};
use crate::json::{parse_json, JsonRef};
use crate::json_validator::JsonValidator;
use crate::liquid_doc::{extract_doc_definition, DocDefinition};
use crate::path;
use crate::schema::{is_block, is_section, is_snippet, to_schema_with, ThemeSchema};
use crate::source::{Position, SourceCode};
use liquid_ast::NodeRef;
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Error = 0,
    Warning = 1,
    Info = 2,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Theme,
    App,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SourceKind {
    LiquidHtml,
    Json,
}

// ---------------------------------------------------------------------------------------------
// File system (`AbstractFileSystem`)

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

#[derive(Clone, Copy, Debug)]
pub struct FileStat {
    pub file_type: FileType,
    /// TS `size`: bytes on disk for `NodeFileSystem`; the UTF-16 length of the source for the
    /// specs' in-memory fs.
    pub size: usize,
}

/// Errors are the TS error messages (only used for `check error:` output).
pub trait FileSystem: Sync {
    fn read_file(&self, uri: &str) -> Result<String, String>;
    fn stat(&self, uri: &str) -> Result<FileStat, String>;
    fn read_directory(&self, uri: &str) -> Result<Vec<(String, FileType)>, String>;
}

// ---------------------------------------------------------------------------------------------
// Offenses and errors

#[derive(Clone, Debug)]
pub struct Offense {
    pub check: &'static str,
    pub kind: SourceKind,
    pub uri: String,
    pub message: String,
    pub severity: Severity,
    /// UTF-8 byte offsets as reported.
    pub start_byte: usize,
    pub end_byte: usize,
    /// TS `getPosition(source, index)`, in UTF-16 units.
    pub start: Position,
    pub end: Position,
    /// TS `fix` and `suggest` (`None` is `undefined`).
    pub fix: Option<Fix>,
    pub suggest: Option<Vec<Suggestion>>,
}

/// A thrown error: the check stops for this file and the runner hands it to `onError`.
#[derive(Clone, Debug)]
pub struct CheckError(pub String);

impl CheckError {
    pub fn new(message: impl Into<String>) -> Self {
        CheckError(message.into())
    }
}

pub type CheckResult = Result<(), CheckError>;

// ---------------------------------------------------------------------------------------------
// Check traits

/// A Liquid check instance for one file (what TS `create()` returns). Node methods only run for
/// the `NodeKind`s in `node_mask()` / `exit_mask()` (`NodeKind::X.bit() | ...`).
#[allow(unused_variables)]
pub trait LiquidCheck<'a> {
    fn node_mask(&self) -> u64 {
        0
    }
    fn exit_mask(&self) -> u64 {
        0
    }
    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        Ok(())
    }
    /// `[node.type](node, ancestors)`. `ancestors.last()` is the parent (TS `ancestors.at(-1)`).
    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        Ok(())
    }
    /// `['<type>:exit'](node, ancestors)`. Runs right after the node's children are queued, before
    /// they're visited, like the TS walker.
    fn node_exit(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        Ok(())
    }
    /// Only runs when the file parsed.
    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        Ok(())
    }
}

/// A JSON check instance for one file. Masks are `JsonKind::X.bit() | ...`.
#[allow(unused_variables)]
pub trait JsonCheck<'a> {
    fn node_mask(&self) -> u64 {
        0
    }
    fn exit_mask(&self) -> u64 {
        0
    }
    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        Ok(())
    }
    fn node(
        &mut self,
        node: JsonRef<'a>,
        ancestors: &[JsonRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        Ok(())
    }
    fn node_exit(
        &mut self,
        node: JsonRef<'a>,
        ancestors: &[JsonRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        Ok(())
    }
    /// Only runs when the file parsed.
    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        Ok(())
    }
}

/// `create(context)`. `None` stands for TS `{}` (nothing to run for this file).
pub type CreateLiquid = for<'a> fn(&mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>>;
pub type CreateJson = for<'a> fn(&mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>>;

#[derive(Clone, Copy)]
pub enum Create {
    Liquid(CreateLiquid),
    Json(CreateJson),
}

/// TS `CheckDefinition.meta` + `create`.
pub struct CheckDef {
    pub code: &'static str,
    pub name: &'static str,
    pub aliases: &'static [&'static str],
    pub severity: Severity,
    pub recommended: bool,
    pub deprecated: bool,
    /// Settings schema: (key, default as JSON). `null` for TS's `undefined`.
    pub schema: &'static [(&'static str, &'static str)],
    pub create: Create,
}

impl CheckDef {
    pub fn kind(&self) -> SourceKind {
        match self.create {
            Create::Liquid(_) => SourceKind::LiquidHtml,
            Create::Json(_) => SourceKind::Json,
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Config

/// TS `Config` minus `rootUri`/`context` (those live on `Deps`).
pub struct Config {
    pub checks: Vec<&'static CheckDef>,
    /// TS `ChecksSettings`: `{ [code]: { severity?, ignore?, ...settings } }`.
    pub settings: Map<String, Value>,
    pub ignore: Vec<String>,
    /// `createSettings(config.settings[code], schema)` per check, same order as `checks`.
    resolved: Vec<Map<String, Value>>,
}

impl Config {
    pub fn new(
        checks: Vec<&'static CheckDef>,
        settings: Map<String, Value>,
        ignore: Vec<String>,
    ) -> Self {
        let resolved = checks
            .iter()
            .map(|def| {
                let given = settings.get(def.code);
                let mut out = Map::new();
                for (key, default) in def.schema {
                    let value = match given.and_then(|g| g.get(*key)) {
                        Some(v) if !v.is_null() => v.clone(),
                        _ => serde_json::from_str(default).expect("bad settings default"),
                    };
                    out.insert(key.to_string(), value);
                }
                out
            })
            .collect();
        Config {
            checks,
            settings,
            ignore,
            resolved,
        }
    }

    pub(crate) fn resolved_settings(&self, i: usize) -> &Map<String, Value> {
        &self.resolved[i]
    }

    /// `checkSettings?.severity ?? check.meta.severity`
    pub(crate) fn severity(&self, def: &CheckDef) -> Severity {
        match self
            .settings
            .get(def.code)
            .and_then(|s| s.get("severity"))
            .and_then(Value::as_u64)
        {
            Some(0) => Severity::Error,
            Some(1) => Severity::Warning,
            Some(2) => Severity::Info,
            _ => def.severity,
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Deps

/// What the injected `Dependencies` provide beyond `fs` and `themeDocset`.
#[derive(Clone, Copy, Default)]
pub struct Providers {
    /// `getBlockSchema` / `getSectionSchema` / `getDocDefinition` from the theme's own files, as
    /// the spec test-helper builds them (schemas are always valid).
    pub theme_schemas: bool,
}

/// TS `AugmentedDependencies`, minus per-file bits. All lookups are memoized and `Sync`.
pub struct Deps<'a> {
    pub theme: &'a [SourceCode<'a>],
    pub root_uri: String,
    pub mode: Mode,
    pub fs: &'a dyn FileSystem,
    /// Already augmented (`AugmentedThemeDocset`).
    pub docset: Option<ThemeDocset>,
    pub providers: Providers,
    blocks: HashMap<String, usize>,
    sections: HashMap<String, usize>,
    schemas: Vec<OnceLock<Option<ThemeSchema<'a>>>>,
    doc_defs: Vec<OnceLock<Option<DocDefinition>>>,
    doc_def_lookup: Mutex<HashMap<String, Option<usize>>>,
    block_params: Vec<OnceLock<Option<BlockParameters>>>,
    default_locale: OnceLock<String>,
    default_schema_locale: OnceLock<String>,
    default_translations: OnceLock<Option<Value>>,
    default_schema_translations: OnceLock<Option<Value>>,
    /// Answers for the deps in `mocked`, which a spec states rather than derives from the theme
    /// (`references`, remote files).
    pub recorded: Vec<RecordedCall>,
    /// The deps that answer from `recorded`.
    pub mocked: Vec<String>,
    /// What `getReferences` / `getDependencies` answer from (`graph::build_theme_graph`, as
    /// theme-check-node wires them). `None`: those deps are `undefined`. `Some(Err)`: the build
    /// threw, so they answer `[]`.
    pub theme_graph: Option<Result<crate::graph::ThemeGraph, String>>,
    /// ValidScopedCSSClass's per-run CSS classes. `None`: no `getCSSClassesForURI`.
    pub(crate) scoped_css_classes: OnceLock<Option<ScopedCssClasses>>,
    /// theme-check-node's `docDefinitions`: theme file index by
    /// `path.relative(URI.file(root).toString(), uri)`. `None`: the test-helper's lookup.
    pub doc_definition_keys: Option<HashMap<String, usize>>,
    /// theme-check-node's `cssClassesForURI` keys (theme `.liquid` files and `assets/*.css`);
    /// other uris have no classes. `None`: the test-helper's (any uri).
    pub css_class_uris: Option<HashSet<String>>,
    css_classes: Mutex<HashMap<String, HashSet<String>>>,
    /// `validateJSON`: the `JSONValidator.create(jsonValidationSet, config)` that `check()` makes.
    pub json_validator: Option<JsonValidator>,
    /// theme-check-node's second `JSONValidator`, whose `isValid` is `toSchema`'s
    /// `isValidSchema`. `None` is the spec test-helper's always-true one.
    pub schema_validator: Option<JsonValidator>,
}

/// `getCSSClassesForURI` memoized over `assets/*.css` and the theme's `.liquid` files, plus
/// ValidScopedCSSClass's `getAssetCSSClasses` and `getAllThemeCSSClasses` unions.
pub(crate) struct ScopedCssClasses {
    pub per_uri: HashMap<String, HashSet<String>>,
    pub assets: HashSet<String>,
    pub all: HashSet<String>,
}

/// `deps[dep](...args)` or `deps[dep][method](...args)`, and what it returns (`Ok`) or throws
/// (`Err`, the message).
#[derive(Clone, Debug)]
pub struct RecordedCall {
    pub dep: String,
    pub method: Option<String>,
    pub args: Value,
    pub result: Result<Value, String>,
}

impl<'a> Deps<'a> {
    pub fn new(
        theme: &'a [SourceCode<'a>],
        root_uri: &str,
        mode: Mode,
        fs: &'a dyn FileSystem,
        docset: Option<ThemeDocset>,
        providers: Providers,
    ) -> Self {
        // test-helper: `new Map(theme.filter(isBlock).map(f => [basename(f.uri, '.liquid'), f]))`
        let mut blocks = HashMap::new();
        let mut sections = HashMap::new();
        for (i, f) in theme.iter().enumerate() {
            if is_block(&f.uri) {
                blocks.insert(path::basename(&f.uri, Some(".liquid")), i);
            }
            if is_section(&f.uri) {
                sections.insert(path::basename(&f.uri, Some(".liquid")), i);
            }
        }
        let n = theme.len();
        Deps {
            theme,
            root_uri: root_uri.to_string(),
            mode,
            fs,
            docset,
            providers,
            blocks,
            sections,
            schemas: (0..n).map(|_| OnceLock::new()).collect(),
            doc_defs: (0..n).map(|_| OnceLock::new()).collect(),
            doc_def_lookup: Mutex::new(HashMap::new()),
            block_params: (0..n).map(|_| OnceLock::new()).collect(),
            default_locale: OnceLock::new(),
            default_schema_locale: OnceLock::new(),
            default_translations: OnceLock::new(),
            default_schema_translations: OnceLock::new(),
            recorded: Vec::new(),
            mocked: Vec::new(),
            theme_graph: None,
            scoped_css_classes: OnceLock::new(),
            doc_definition_keys: None,
            css_class_uris: None,
            css_classes: Mutex::new(HashMap::new()),
            json_validator: None,
            schema_validator: None,
        }
    }

    /// The recorded result of `deps[dep][method](...args)`, if this dep was mocked.
    pub fn recorded(
        &self,
        dep: &str,
        method: Option<&str>,
        args: &Value,
    ) -> Option<&Result<Value, String>> {
        self.recorded
            .iter()
            .find(|c| c.dep == dep && c.method.as_deref() == method && &c.args == args)
            .map(|c| &c.result)
    }

    /// Whether `dep` answers from `recorded`, not from the theme.
    pub fn is_mocked(&self, dep: &str) -> bool {
        self.mocked.iter().any(|d| d == dep)
    }

    /// `toUri(relativePath)`
    pub fn to_uri(&self, relative_path: &str) -> String {
        let parts: Vec<&str> = relative_path.split('/').collect();
        path::join(&self.root_uri, &parts)
    }

    /// `toRelativePath(uri)`
    pub fn to_relative_path(&self, uri: &str) -> String {
        path::relative(uri, &self.root_uri)
    }

    /// `fileExists(uri)`
    pub fn file_exists(&self, uri: &str) -> bool {
        self.fs.stat(uri).is_ok()
    }

    /// `fileSize(uri)` (0 when missing)
    pub fn file_size(&self, uri: &str) -> usize {
        self.fs.stat(uri).map_or(0, |s| s.size)
    }

    fn default_locale_file(&self, postfix: &str) -> Result<Option<String>, String> {
        let files = self
            .fs
            .read_directory(&path::join(&self.root_uri, &["locales"]))?;
        Ok(files
            .into_iter()
            .find(|(uri, _)| uri.ends_with(postfix))
            .map(|(uri, _)| uri))
    }

    fn compute_default_locale(&self, postfix: &str) -> String {
        match self.default_locale_file(postfix) {
            Ok(Some(uri)) => path::basename(&uri, None)
                .split('.')
                .next()
                .unwrap_or("")
                .to_string(),
            _ => "en".to_string(),
        }
    }

    fn compute_default_translations(&self, postfix: &str) -> Option<Value> {
        let buffer = self
            .theme
            .iter()
            .find(|f| !f.is_liquid() && f.uri.contains("locales") && f.uri.ends_with(postfix));
        if let Some(v) = buffer
            .and_then(|f| parse_json(f.source))
            .filter(crate::json::truthy)
        {
            return Some(v);
        }
        match self.default_locale_file(postfix) {
            Ok(Some(uri)) => match self.fs.read_file(&uri) {
                Ok(source) => parse_json(&source),
                Err(_) => Some(Value::Object(Map::new())),
            },
            _ => Some(Value::Object(Map::new())),
        }
    }

    /// `getDefaultLocale()`
    pub fn default_locale(&self) -> &str {
        self.default_locale
            .get_or_init(|| self.compute_default_locale(".default.json"))
    }

    /// `getDefaultSchemaLocale()`
    pub fn default_schema_locale(&self) -> &str {
        self.default_schema_locale
            .get_or_init(|| self.compute_default_locale(".default.schema.json"))
    }

    /// `getDefaultTranslations()`. `None` is JS `undefined` (an empty or invalid file on disk).
    pub fn default_translations(&self) -> Option<&Value> {
        self.default_translations
            .get_or_init(|| self.compute_default_translations(".default.json"))
            .as_ref()
    }

    /// `getDefaultSchemaTranslations()`
    pub fn default_schema_translations(&self) -> Option<&Value> {
        self.default_schema_translations
            .get_or_init(|| self.compute_default_translations(".default.schema.json"))
            .as_ref()
    }

    fn schema_at(&self, i: usize) -> Option<&ThemeSchema<'a>> {
        let theme = self.theme;
        self.schemas[i]
            .get_or_init(|| to_schema_with(self.mode, &theme[i], self.schema_validator.as_ref()))
            .as_ref()
    }

    /// `getBlockSchema(name)`
    pub fn get_block_schema(&self, name: &str) -> Option<&ThemeSchema<'a>> {
        if !self.providers.theme_schemas {
            return None;
        }
        self.schema_at(*self.blocks.get(name)?)
    }

    /// `getSectionSchema(name)`
    pub fn get_section_schema(&self, name: &str) -> Option<&ThemeSchema<'a>> {
        if !self.providers.theme_schemas {
            return None;
        }
        self.schema_at(*self.sections.get(name)?)
    }

    /// `getAppBlockSchema(name)`: theme-check-node's returns the block schema ("cheating... but
    /// TODO"), and no check reads it.
    pub fn get_app_block_schema(&self, name: &str) -> Option<&ThemeSchema<'a>> {
        self.get_block_schema(name)
    }

    /// `getDocDefinition(relativePath)`: the first theme file whose uri ends with it, or
    /// theme-check-node's exact `doc_definition_keys` match.
    pub fn get_doc_definition(&self, relative_path: &str) -> Option<&DocDefinition> {
        if !self.providers.theme_schemas {
            return None;
        }
        let i = match &self.doc_definition_keys {
            // `filePathSupportsLiquidDoc(file.uri)`
            Some(keys) => keys
                .get(relative_path)
                .copied()
                .filter(|&i| is_snippet(&self.theme[i].uri) || is_block(&self.theme[i].uri))?,
            None => *self
                .doc_def_lookup
                .lock()
                .unwrap()
                .entry(relative_path.to_string())
                .or_insert_with(|| {
                    self.theme
                        .iter()
                        .position(|f| f.uri.ends_with(relative_path))
                })
                .as_ref()?,
        };
        let f = &self.theme[i];
        self.doc_defs[i]
            .get_or_init(|| {
                f.liquid_ast()
                    .map(|ast| extract_doc_definition(&f.uri, ast))
            })
            .as_ref()
    }

    /// `getBlockParameters(blockName)` (`makeGetBlockParameters`).
    pub fn get_block_parameters(&self, block_name: &str) -> Option<&BlockParameters> {
        if !self.providers.theme_schemas {
            return None;
        }
        let i = *self.blocks.get(block_name)?;
        self.block_params[i]
            .get_or_init(|| self.load_block_parameters(block_name))
            .as_ref()
    }

    fn load_block_parameters(&self, block_name: &str) -> Option<BlockParameters> {
        let schema = self.get_block_schema(block_name)?;
        let doc = self.get_doc_definition(&format!("blocks/{block_name}.liquid"))?;
        match schema.valid_schema() {
            // App blocks have no `validSchema` (`undefined` isn't an Error).
            None => Some(resolve_block_parameters(None, Some(doc))),
            Some(Ok(v)) => Some(resolve_block_parameters(v.as_ref(), Some(doc))),
            _ if schema.has_no_schema_tag() => Some(resolve_block_parameters(None, Some(doc))),
            _ => None,
        }
    }

    /// `getCSSClassesForURI(uri)` as the spec test-helper wires it (`.css` assets, else the
    /// file's `{% stylesheet %}` tags), or theme-check-node with `css_class_uris`. Memoized.
    pub fn get_css_classes_for_uri(&self, uri: &str) -> Option<HashSet<String>> {
        if !self.providers.theme_schemas {
            return None;
        }
        if self
            .css_class_uris
            .as_ref()
            .is_some_and(|uris| !uris.contains(uri))
        {
            return Some(HashSet::new());
        }
        if let Some(classes) = self.css_classes.lock().unwrap().get(uri) {
            return Some(classes.clone());
        }
        let classes = if uri.ends_with(".css") {
            crate::checks::styles::extract_css_classes_from_asset_uri(uri, self.fs)
        } else {
            crate::checks::styles::extract_css_classes_from_liquid_uri(uri, self.fs)
        };
        self.css_classes
            .lock()
            .unwrap()
            .insert(uri.to_string(), classes.clone());
        Some(classes)
    }
}

// ---------------------------------------------------------------------------------------------
// Context

/// TS `Context`: per (file, check). Everything borrowed from it lives for `'a`, so it's fine to
/// hold on to `cx.file`, `cx.deps` lookups etc. while calling `cx.report`.
pub struct Context<'a> {
    pub file: &'a SourceCode<'a>,
    pub deps: &'a Deps<'a>,
    /// `createSettings`: schema keys with config values or defaults.
    pub settings: &'a Map<String, Value>,
    pub def: &'static CheckDef,
    pub(crate) severity: Severity,
    pub(crate) offenses: Vec<Offense>,
}

impl<'a> Context<'a> {
    pub fn source(&self) -> &'a str {
        self.file.source
    }

    pub fn uri(&self) -> &'a str {
        &self.file.uri
    }

    /// `context.report({ message, startIndex, endIndex })` with UTF-8 byte offsets.
    pub fn report(&mut self, message: impl Into<String>, start: usize, end: usize) {
        self.report_with(message, start, end, None, None);
    }

    /// `context.report({ message, startIndex, endIndex, fix, suggest })`.
    pub fn report_with(
        &mut self,
        message: impl Into<String>,
        start: usize,
        end: usize,
        fix: Option<Fix>,
        suggest: Option<Vec<Suggestion>>,
    ) {
        self.offenses.push(Offense {
            check: self.def.code,
            kind: self.def.kind(),
            uri: self.file.uri.clone(),
            message: message.into(),
            severity: self.severity,
            start_byte: start,
            end_byte: end,
            start: self.file.position(start),
            end: self.file.position(end),
            fix,
            suggest,
        });
    }

    pub fn mode(&self) -> Mode {
        self.deps.mode
    }
    pub fn to_uri(&self, relative_path: &str) -> String {
        self.deps.to_uri(relative_path)
    }
    pub fn to_relative_path(&self, uri: &str) -> String {
        self.deps.to_relative_path(uri)
    }
    pub fn file_exists(&self, uri: &str) -> bool {
        self.deps.file_exists(uri)
    }
    pub fn file_size(&self, uri: &str) -> usize {
        self.deps.file_size(uri)
    }
    pub fn docset(&self) -> Option<&'a ThemeDocset> {
        self.deps.docset.as_ref()
    }
    pub fn default_locale(&self) -> &'a str {
        self.deps.default_locale()
    }
    pub fn default_schema_locale(&self) -> &'a str {
        self.deps.default_schema_locale()
    }
    pub fn default_translations(&self) -> Option<&'a Value> {
        self.deps.default_translations()
    }
    pub fn default_schema_translations(&self) -> Option<&'a Value> {
        self.deps.default_schema_translations()
    }
    pub fn get_block_schema(&self, name: &str) -> Option<&'a ThemeSchema<'a>> {
        self.deps.get_block_schema(name)
    }
    pub fn get_section_schema(&self, name: &str) -> Option<&'a ThemeSchema<'a>> {
        self.deps.get_section_schema(name)
    }
    pub fn get_doc_definition(&self, relative_path: &str) -> Option<&'a DocDefinition> {
        self.deps.get_doc_definition(relative_path)
    }
    pub fn get_block_parameters(&self, block_name: &str) -> Option<&'a BlockParameters> {
        self.deps.get_block_parameters(block_name)
    }
    pub fn get_css_classes_for_uri(&self, uri: &str) -> Option<HashSet<String>> {
        self.deps.get_css_classes_for_uri(uri)
    }

    /// `getSchema(context)`: this file's block or section schema.
    pub fn get_schema(&self) -> Option<&'a ThemeSchema<'a>> {
        let name = path::basename(&self.file.uri, Some(".liquid"));
        if is_block(&self.file.uri) {
            self.get_block_schema(&name)
        } else if is_section(&self.file.uri) {
            self.get_section_schema(&name)
        } else {
            None
        }
    }

    /// `settings[key]` as a number / string / string list.
    pub fn setting_f64(&self, key: &str) -> Option<f64> {
        self.settings.get(key).and_then(Value::as_f64)
    }
    pub fn setting_str(&self, key: &str) -> Option<&'a str> {
        self.settings.get(key).and_then(Value::as_str)
    }
    pub fn setting_strs(&self, key: &str) -> Vec<&'a str> {
        self.settings
            .get(key)
            .and_then(Value::as_array)
            .map_or(Vec::new(), |a| a.iter().filter_map(Value::as_str).collect())
    }
}
