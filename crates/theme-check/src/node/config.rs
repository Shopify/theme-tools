//! theme-check-node `config/`: `findConfigPath`, `loadConfig`, `resolveConfig` (with `read-yaml`
//! and `merge-fragments`), `loadConfigDescription` and `validateConfig`.

use super::{fs_error, posix_join, posix_resolve, JsError};
use crate::json::{js_insert, truthy};
use crate::path::posix_dirname;
use crate::{js, path, yaml};
use serde_json::{Map, Value};
use std::sync::LazyLock;

/// TS `Config` as theme-check-node loads it. `checks` index into [`check_metas`].
pub struct NodeConfig {
    pub settings: Map<String, Value>,
    pub context: String,
    pub checks: Vec<usize>,
    pub ignore: Vec<Value>,
    pub root_uri: String,
}

/// `allChecks.map((c) => c.meta)`, copied from the TS. CI checks that it's current.
pub fn check_metas() -> &'static [Value] {
    static METAS: LazyLock<Vec<Value>> =
        LazyLock::new(|| serde_json::from_str(include_str!("checks-meta.json")).unwrap());
    &METAS
}

fn meta_code(meta: &Value) -> &str {
    meta["code"].as_str().unwrap_or_default()
}

fn meta_aliases(meta: &Value) -> impl Iterator<Item = &str> {
    meta.get("aliases")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
}

/// `theme-check-node/configs/*.yml`, by modern identifier.
const MODERN_CONFIGS: [(&str, &str); 4] = [
    ("theme-check:nothing", include_str!("configs/nothing.yml")),
    (
        "theme-check:recommended",
        include_str!("configs/recommended.yml"),
    ),
    (
        "theme-check:theme-app-extension",
        include_str!("configs/theme-app-extension.yml"),
    ),
    ("theme-check:all", include_str!("configs/all.yml")),
];

const LEGACY_IDENTIFIERS: [(&str, &str); 8] = [
    ("default", "theme-check:recommended"),
    ("recommended", "theme-check:recommended"),
    ("all", "theme-check:all"),
    ("nothing", "theme-check:nothing"),
    ("theme_app_extension", "theme-check:theme-app-extension"),
    ("theme_app_extensions", "theme-check:theme-app-extension"),
    ("theme-app-extension", "theme-check:theme-app-extension"),
    ("theme-app-extensions", "theme-check:theme-app-extension"),
];

fn legacy_identifier(s: &str) -> Option<&'static str> {
    LEGACY_IDENTIFIERS
        .iter()
        .find(|(k, _)| *k == s)
        .map(|(_, v)| *v)
}

/// TS `ConfigFragment`, and `ConfigDescription` once `extends` is resolved.
#[derive(Default)]
struct Fragment {
    root: Option<Value>,
    ignore: Vec<Value>,
    extends: Vec<String>,
    require: Vec<String>,
    check_settings: Map<String, Value>,
    context: Option<String>,
}

/// `findConfigPath(root)`
pub fn find_config_path(root: &str) -> Option<String> {
    let p = posix_join(root, ".theme-check.yml");
    std::fs::metadata(&p).is_ok().then_some(p)
}

/// index.ts `loadConfig(configPath, root)`: load-config.ts `loadConfig`, with the config path
/// found in `root` by default.
pub fn load_config(config_path: Option<&str>, root: &str) -> Result<NodeConfig, JsError> {
    let config_path = config_path
        .map(String::from)
        .or_else(|| find_config_path(root));
    if root.is_empty() {
        return Err(JsError::error(
            "loadConfig cannot be called without a root argument",
        ));
    }
    let mut default_checks = "theme-check:recommended";
    if config_path.as_deref().map_or(true, str::is_empty) {
        let files = std::fs::read_dir(root).map_err(|e| fs_error(&e, "scandir", root))?;
        let names: Vec<String> = files
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        // *.extension.toml: we're in an extensions directory. *.app.toml: we're in an app's root.
        if names
            .iter()
            .any(|f| f.ends_with(".extension.toml") || f.ends_with(".app.toml"))
        {
            default_checks = "theme-check:theme-app-extension";
        }
    }
    let description = resolve_config(config_path.as_deref().unwrap_or(default_checks), true, &[])?;
    let config = load_config_description(description, root)?;
    validate_config(&config)?;
    Ok(config)
}

// ---------------------------------------------------------------------------------------------
// resolve-config.ts, read-yaml.ts, merge-fragments.ts

/// `resolveConfig(configPath, isRootConfig, extendedBy)`, where `extended_by` is the configs that
/// extend this one, from the root config down. ponytail: the first failing `extends` in order
/// wins, where `Promise.all` rejects with whichever read fails first.
fn resolve_config(
    config_path: &str,
    is_root_config: bool,
    extended_by: &[String],
) -> Result<Fragment, JsError> {
    let modern = MODERN_CONFIGS.iter().find(|(id, _)| *id == config_path);
    let path = modern.map_or(config_path.to_string(), |(id, _)| {
        format!("configs/{}.yml", &id["theme-check:".len()..])
    });
    let chain = [extended_by, &[path.clone()]].concat();
    if extended_by.contains(&path) {
        return Err(JsError::error(format!(
            "Cyclic extends in theme-check config: {}",
            chain.join(" -> ")
        )));
    }
    let current = match modern {
        Some((_, src)) => read_yaml(&path, src, false)?,
        None => {
            let bytes =
                std::fs::read(config_path).map_err(|e| fs_error(&e, "open", config_path))?;
            read_yaml(
                config_path,
                &String::from_utf8_lossy(&bytes),
                is_root_config,
            )?
        }
    };
    let bases = current
        .extends
        .iter()
        .map(|e| resolve_config(e, false, &chain))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(merge_fragments(bases, current))
}

fn merge_fragments(bases: Vec<Fragment>, config: Fragment) -> Fragment {
    // selectLatest: the last truthy one.
    let root = bases
        .iter()
        .map(|b| b.root.clone())
        .chain([config.root.clone()])
        .flatten()
        .filter(truthy)
        .last();
    let context = bases
        .iter()
        .map(|b| b.context.clone())
        .chain([config.context.clone()])
        .flatten()
        .filter(|c| !c.is_empty())
        .last();
    let mut check_settings: Option<Map<String, Value>> = None;
    for s in bases
        .iter()
        .map(|b| &b.check_settings)
        .chain([&config.check_settings])
    {
        check_settings = Some(match check_settings {
            None => s.clone(),
            Some(acc) => merge_deep(&acc, s),
        });
    }
    Fragment {
        root,
        extends: Vec::new(),
        ignore: bases
            .iter()
            .flat_map(|b| b.ignore.iter().cloned())
            .chain(config.ignore)
            .collect(),
        require: bases
            .iter()
            .flat_map(|b| b.require.iter().cloned())
            .chain(config.require)
            .collect(),
        check_settings: check_settings.unwrap_or_default(),
        context: Some(context.unwrap_or_else(|| "theme".into())),
    }
}

fn merge_deep(target: &Map<String, Value>, source: &Map<String, Value>) -> Map<String, Value> {
    let mut output = target.clone();
    for (key, value) in source {
        let merged = match (target.get(key), value) {
            (Some(Value::Object(t)), Value::Object(s)) => Value::Object(merge_deep(t, s)),
            _ => value.clone(),
        };
        js_insert(&mut output, key.clone(), merged);
    }
    output
}

fn parse_yaml_file(absolute_path: &str, contents: &str) -> Result<Map<String, Value>, JsError> {
    let result = if js::trim(contents).is_empty() {
        Value::Object(Map::new())
    } else {
        match yaml::parse(contents) {
            Ok(v) => v,
            Err(yaml::YamlError::UnresolvedAlias(alias)) => {
                let message = yaml::YamlError::UnresolvedAlias(alias.clone()).message();
                return Err(JsError::new(
                    "UnresolvedAliasError",
                    format!(
                        "YAML parsing error: Unresolved alias *{alias}.\nDid you forget to wrap your ignore statement in quotes? '*{alias}'\n{message}"
                    ),
                ));
            }
            Err(e) => return Err(JsError::new(e.name(), e.message())),
        }
    };
    match result {
        Value::Object(m) => Ok(m),
        _ => Err(JsError::error(format!(
            "Expecting parsed contents of config file at path '{absolute_path}' to be a plain object"
        ))),
    }
}

/// `readYamlConfigDescription(absolutePath, isRootConfig)` on the file's contents.
fn read_yaml(
    absolute_path: &str,
    contents: &str,
    is_root_config: bool,
) -> Result<Fragment, JsError> {
    let root = posix_dirname(absolute_path).to_string();
    let mut yaml_file = parse_yaml_file(absolute_path, contents)?;
    // `if (yamlFile.x) { ...; delete yamlFile.x }`: falsy values stay and fail as check settings.
    let mut take = |key: &str| {
        if yaml_file.get(key).is_some_and(truthy) {
            yaml_file.shift_remove(key)
        } else {
            None
        }
    };
    let mut config = Fragment::default();
    if let Some(v) = take("root") {
        config.root = Some(v);
    }
    if let Some(v) = take("ignore") {
        config.ignore = as_array(v);
    }
    if let Some(v) = take("require") {
        config.require = as_array(v)
            .iter()
            .map(|p| resolve_path(&root, p))
            .collect::<Result<_, _>>()?;
    }
    if let Some(v) = take("extends") {
        let resolved = as_array(v)
            .iter()
            .map(|p| resolve_extends(&root, p))
            .collect::<Result<Vec<_>, _>>()?;
        config.extends = resolved.into_iter().flatten().collect();
    } else if is_root_config {
        config.extends = vec!["theme-check:recommended".into()];
    }
    if let Some(v) = take("context") {
        if let Some(c) = v.as_str().filter(|c| *c == "theme" || *c == "app") {
            config.context = Some(c.to_string());
        }
    }
    // legacy settings that screw up assumptions
    take("include_categories");
    take("exclude_categories");
    for (check_name, settings) in yaml_file {
        let Value::Object(settings) = settings else {
            return Err(JsError::error(format!(
                "Expected a plain object value for {check_name} but got {}",
                type_of(&settings)
            )));
        };
        js_insert(
            &mut config.check_settings,
            check_name,
            Value::Object(resolve_settings(&settings)?),
        );
    }
    Ok(config)
}

fn as_array(v: Value) -> Vec<Value> {
    match v {
        Value::Array(a) => a,
        v => vec![v],
    }
}

/// `resolveExtends(root, pathLike)`: `None` for an unknown legacy identifier.
fn resolve_extends(root: &str, path_like: &Value) -> Result<Option<String>, JsError> {
    let p = match path_like {
        Value::String(p) => p,
        Value::Null => {
            return Err(JsError::new(
                "TypeError",
                "Cannot read properties of null (reading 'startsWith')",
            ))
        }
        _ => {
            return Err(JsError::new(
                "TypeError",
                "pathLike.startsWith is not a function",
            ))
        }
    };
    if p.starts_with(':') || legacy_identifier(p).is_some() {
        return Ok(legacy_identifier(p.strip_prefix(':').unwrap_or(p)).map(String::from));
    }
    if p.starts_with("theme-check:") {
        return Ok(Some(p.clone()));
    }
    resolve_path(root, path_like).map(Some)
}

/// `resolvePath(root, pathLike)`
fn resolve_path(root: &str, path_like: &Value) -> Result<String, JsError> {
    let Value::String(p) = path_like else {
        return Err(invalid_path_type(path_like));
    };
    if p.starts_with('/') {
        return Ok(p.clone());
    }
    if p.starts_with('.') {
        return Ok(posix_resolve(root, p));
    }
    // `realpathSync(createRequire(join(root, '__placeholder')).resolve(pathLike))`.
    // ponytail: only finds `node_modules/<pathLike>` as an exact file in root or an ancestor; no
    // package `main`/`exports`, extension or `NODE_PATH` resolution.
    let mut dir = root.to_string();
    loop {
        let candidate = posix_join(&dir, &format!("node_modules/{p}"));
        if std::fs::metadata(&candidate).is_ok_and(|m| m.is_file()) {
            return Ok(std::fs::canonicalize(&candidate)
                .map_or(candidate, |c| c.to_string_lossy().into_owned()));
        }
        let parent = posix_dirname(&dir).to_string();
        if parent == dir {
            break;
        }
        dir = parent;
    }
    let placeholder = posix_join(root, "__placeholder");
    Err(JsError::error(format!(
        "Cannot find module '{p}'\nRequire stack:\n- {placeholder}"
    )))
}

/// Node's `ERR_INVALID_ARG_TYPE` for a non-string `path` argument.
fn invalid_path_type(v: &Value) -> JsError {
    let received = match v {
        Value::Null => "null".to_string(),
        Value::Array(_) => "an instance of Array".to_string(),
        Value::Object(_) => "an instance of Object".to_string(),
        v => format!("type {} ({})", type_of(v), js::to_string(v)),
    };
    JsError::new(
        "TypeError [ERR_INVALID_ARG_TYPE]",
        format!("The \"path\" argument must be of type string. Received {received}"),
    )
}

/// `resolveSettings(settings)`: camelCased keys, `enabled` defaulting to true, convenience
/// severities.
fn resolve_settings(settings: &Map<String, Value>) -> Result<Map<String, Value>, JsError> {
    let mut resolved = Map::new();
    let enabled = settings
        .get("enabled")
        .filter(|v| truthy(v))
        .cloned()
        .unwrap_or(Value::Bool(true));
    resolved.insert("enabled".into(), enabled);
    for (key, value) in settings {
        js_insert(&mut resolved, to_camel_case(key), value.clone());
    }
    if let Some(severity) = settings.get("severity") {
        js_insert(
            &mut resolved,
            "severity".into(),
            resolve_severity(severity)?,
        );
    }
    Ok(resolved)
}

/// ponytail: JS `severity in ConvenienceSeverities` also takes Object.prototype names
/// (`toString`, ...) and sets a function; those are unsupported severities here.
fn resolve_severity(severity: &Value) -> Result<Value, JsError> {
    const CONVENIENCE: [(&str, u8); 5] = [
        ("suggestion", 1),
        ("style", 2),
        ("error", 0),
        ("warning", 1),
        ("info", 2),
    ];
    match severity {
        Value::String(s) => {
            if let Some((_, n)) = CONVENIENCE.iter().find(|(k, _)| k == s) {
                return Ok(Value::from(*n));
            }
        }
        // `severity in Severity`: "0", "1" or "2".
        Value::Number(n) if n.as_f64().is_some_and(|f| f == 0.0 || f == 1.0 || f == 2.0) => {
            return Ok(severity.clone())
        }
        _ => {}
    }
    Err(JsError::error(format!(
        "Unsupported severity: {}. Try one of suggestion,style,error,warning,info",
        js::to_string(severity)
    )))
}

/// `s.replace(/_([a-z])/g, (_, l) => l.toUpperCase())`
fn to_camel_case(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        match chars.peek() {
            Some(&l) if c == '_' && l.is_ascii_lowercase() => {
                out.push(l.to_ascii_uppercase());
                chars.next();
            }
            _ => out.push(c),
        }
    }
    out
}

/// `typeof v` for a parsed YAML value.
fn type_of(v: &Value) -> &'static str {
    match v {
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Null | Value::Array(_) | Value::Object(_) => "object",
    }
}

// ---------------------------------------------------------------------------------------------
// load-config-description.ts

fn load_config_description(description: Fragment, root: &str) -> Result<NodeConfig, JsError> {
    // ponytail: third-party checks are JS modules; refuse to run without them rather than
    // silently skipping them. The global location (`thisNodeModuleRoot()`) isn't searched.
    let third_party: Vec<String> = description
        .require
        .iter()
        .cloned()
        .chain(find_third_party_checks(&find_node_module_root(root)))
        .collect();
    if !third_party.is_empty() {
        return Err(JsError::error(format!(
            "Third-party checks are not supported by the native theme-check: {}",
            third_party.join(", ")
        )));
    }
    let metas = check_metas();
    let settings_of = |meta: &Value| -> Option<&Value> {
        // `checkSettings[code] ?? aliasedSettings(...)`
        description.check_settings.get(meta_code(meta)).or_else(|| {
            meta_aliases(meta)
                .find_map(|alias| description.check_settings.get(alias).filter(|s| truthy(s)))
        })
    };
    let checks: Vec<usize> = (0..metas.len())
        .filter(|&i| {
            settings_of(&metas[i])
                .and_then(|s| s.get("enabled"))
                .is_some_and(truthy)
        })
        .collect();
    // unaliasedSettings: settings of disabled or unknown checks end up under "undefined".
    let mut settings = Map::new();
    for (key, value) in &description.check_settings {
        let code = checks
            .iter()
            .map(|&i| &metas[i])
            .find(|m| meta_code(m) == key || meta_aliases(m).any(|a| a == key))
            .map_or("undefined", meta_code);
        js_insert(&mut settings, code.to_string(), value.clone());
    }
    Ok(NodeConfig {
        settings,
        context: description.context.unwrap_or_else(|| "theme".into()),
        checks,
        ignore: description.ignore,
        root_uri: resolve_root(root, description.root.as_ref())?,
    })
}

/// `resolveRoot(URI.file(root), pathLike)`
fn resolve_root(root: &str, path_like: Option<&Value>) -> Result<String, JsError> {
    let Some(path_like) = path_like else {
        return Ok(path::file_uri(root));
    };
    let Value::String(p) = path_like else {
        return Err(invalid_path_type(path_like));
    };
    if p.starts_with('/') {
        return Err(JsError::error("the \"root\" property can only be relative"));
    }
    // `Utils.resolvePath(uri, pathLike)`
    Ok(path::file_uri(&posix_resolve(root, p)))
}

fn find_node_module_root(root: &str) -> String {
    let mut curr = root.to_string();
    loop {
        let parent = posix_dirname(&curr).to_string();
        let exists = |name: &str| std::fs::metadata(posix_join(&curr, name)).is_ok();
        if parent == curr || exists("node_modules") || exists(".git") {
            return curr;
        }
        curr = parent;
    }
}

/// `findThirdPartyChecks(nodeModuleRoot)`: `node_modules/theme-check-*/` and
/// `node_modules/@*/theme-check-*/`, minus Shopify's own packages.
fn find_third_party_checks(node_module_root: &str) -> Vec<String> {
    let dirs = |dir: &str, prefix: &str| -> Vec<String> {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return Vec::new();
        };
        let mut names: Vec<String> = entries
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|n| n.starts_with(prefix))
            .filter(|n| std::fs::metadata(format!("{dir}/{n}")).is_ok_and(|m| m.is_dir()))
            .collect();
        names.sort();
        names.into_iter().map(|n| format!("{dir}/{n}")).collect()
    };
    let node_modules = format!("{}/node_modules", node_module_root.trim_end_matches('/'));
    let mut found = dirs(&node_modules, "theme-check-");
    for scope in dirs(&node_modules, "@") {
        found.extend(dirs(&scope, "theme-check-"));
    }
    found
        .into_iter()
        .filter(|p| {
            let shopify = ["node", "common", "browser", "docs-updater"]
                .iter()
                .any(|n| p.contains(&format!("@shopify/theme-check-{n}")));
            !shopify && !p.contains("theme-check-vscode")
        })
        .map(|p| p + "/")
        .collect()
}

// ---------------------------------------------------------------------------------------------
// validation.ts

/// `in` on a plain object also sees Object.prototype.
const OBJECT_PROTOTYPE: [&str; 12] = [
    "constructor",
    "__defineGetter__",
    "__defineSetter__",
    "hasOwnProperty",
    "__lookupGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
    "__proto__",
    "toLocaleString",
];

/// `validateConfig(config)`. Superfluous settings are reported on stderr (`console.error`).
pub fn validate_config(config: &NodeConfig) -> Result<(), JsError> {
    let metas = check_metas();
    for &i in &config.checks {
        let code = meta_code(&metas[i]);
        let Some(settings) = config.settings.get(code).filter(|s| truthy(s)) else {
            return Err(JsError::assertion(format!(
                "Unexpected missing settings for {code} in validateConfig call"
            )));
        };
        let empty = Map::new();
        let schema = metas[i]
            .get("schema")
            .and_then(Value::as_object)
            .unwrap_or(&empty);
        for (key, prop) in schema {
            validate_value(key, settings.get(key), prop)?;
        }
        // validateCommonCheckSettings
        if let Some(severity) = settings.get("severity") {
            assert_type("severity", "number", type_of(severity))?;
        }
        assert_type(
            "enabled",
            "boolean",
            settings.get("enabled").map_or("undefined", type_of),
        )?;
        if let Some(ignore) = settings.get("ignore") {
            assert_array("ignore", ignore)?;
        }
        // validateSuperfluousSettings
        for key in settings.as_object().into_iter().flat_map(|s| s.keys()) {
            let known = schema.contains_key(key) || OBJECT_PROTOTYPE.contains(&key.as_str());
            if !known && !["enabled", "severity", "ignore"].contains(&key.as_str()) {
                eprintln!("Unexpected setting: {key} for check {code} found in configuration");
            }
        }
    }
    Ok(())
}

fn validate_value(key: &str, value: Option<&Value>, schema_prop: &Value) -> Result<(), JsError> {
    let options = &schema_prop["options"];
    let default_value = options.get("defaultValue");
    let Some(value) = value else {
        if options.get("optional") != Some(&Value::Bool(true)) && default_value.is_none() {
            return Err(JsError::error(format!("Missing required setting: {key}")));
        }
        return Ok(());
    };
    // `value === defaultValue`: only primitives can be identical.
    if default_value.is_some_and(|d| !js::is_non_null_object(d) && strict_equals(d, value)) {
        return Ok(());
    }
    match options.get("type").and_then(Value::as_str) {
        Some(ty @ ("string" | "number" | "boolean")) => assert_type(key, ty, type_of(value)),
        Some("object") => {
            if !value.is_object() {
                return Err(JsError::error(format!(
                    "Invalid type for setting {key}: expected object, got {}",
                    type_of(value)
                )));
            }
            for (nested_key, nested) in options
                .get("properties")
                .and_then(Value::as_object)
                .into_iter()
                .flatten()
            {
                validate_value(nested_key, value.get(nested_key), nested)?;
            }
            Ok(())
        }
        Some("array") => {
            assert_array(key, value)?;
            if let Some(item_type) = options.get("itemType") {
                for item in value.as_array().into_iter().flatten() {
                    validate_value(key, Some(item), item_type)?;
                }
            }
            Ok(())
        }
        ty => Err(JsError::error(format!(
            "Unexpected setting type: {}",
            ty.unwrap_or("undefined")
        ))),
    }
}

fn strict_equals(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
        _ => a == b,
    }
}

/// `assert.strictEqual(actual, expected, message)`, with the diff Node prints after it.
fn assert_type(key: &str, expected: &str, actual: &str) -> Result<(), JsError> {
    if actual == expected {
        return Ok(());
    }
    // Strings of 12 chars or less in all (`kMaxShortStringLength`, quotes excluded) get a one-line
    // diff. Node 22+ ends both with a newline.
    let diff = if actual.len() + expected.len() <= 12 {
        format!("\n\n'{actual}' !== '{expected}'\n")
    } else {
        format!("\n+ actual - expected\n\n+ '{actual}'\n- '{expected}'\n")
    };
    Err(JsError::assertion(format!(
        "Invalid type for setting {key}: expected {expected}, got {actual}{diff}"
    )))
}

fn assert_array(key: &str, thing: &Value) -> Result<(), JsError> {
    if thing.is_array() {
        return Ok(());
    }
    Err(JsError::assertion(format!(
        "Invalid type for setting {key}: expected array, got {}",
        type_of(thing)
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn fragments() {
        let f = read_yaml(
            "/x/.theme-check.yml",
            "root: dist\nignore: a/*\nmy_check:\n  max_size: 3\n  severity: style\n",
            true,
        )
        .unwrap();
        assert_eq!(f.root, Some(json!("dist")));
        assert_eq!(f.ignore, [json!("a/*")]);
        assert_eq!(f.extends, ["theme-check:recommended"]);
        assert_eq!(
            Value::Object(f.check_settings),
            json!({"my_check": {"enabled": true, "maxSize": 3, "severity": 2}})
        );
        let base = read_yaml("/x/b.yml", "extends: [':nothing', ':bogus_legacy', ./c.yml]\nA: {enabled: false, o: {x: 1, y: [1]}}\n", false).unwrap();
        assert_eq!(base.extends, ["theme-check:nothing", "/x/c.yml"]);
        let top = read_yaml("/x/t.yml", "A: {o: {y: [2], z: 3}}\ncontext: app\n", false).unwrap();
        let merged = merge_fragments(vec![base], top);
        assert_eq!(merged.context.as_deref(), Some("app"));
        assert_eq!(
            Value::Object(merged.check_settings),
            json!({"A": {"enabled": true, "o": {"x": 1, "y": [2], "z": 3}}})
        );
        let err = |src: &str| {
            read_yaml("/x/e.yml", src, false)
                .err()
                .map(|e| e.to_string())
                .unwrap_or_default()
        };
        assert_eq!(
            err("A: 1\n"),
            "Error: Expected a plain object value for A but got number"
        );
        assert_eq!(
            err("root: ''\n"),
            "Error: Expected a plain object value for root but got string"
        );
        assert_eq!(
            err("A: {severity: 3}\n"),
            "Error: Unsupported severity: 3. Try one of suggestion,style,error,warning,info"
        );
        assert_eq!(err("- 1\n"), "Error: Expecting parsed contents of config file at path '/x/e.yml' to be a plain object");
        assert!(err("ignore:\n  - *.liquid\n")
            .starts_with("UnresolvedAliasError: YAML parsing error: Unresolved alias *.liquid.\n"));
        assert_eq!(to_camel_case("ignore_missing__a_B_c"), "ignoreMissing_A_BC");
    }

    #[test]
    fn rejects_configs_that_extend_each_other() {
        let dir =
            std::env::temp_dir().join(format!("theme-check-cyclic-extends-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let [root, base] =
            [".theme-check.yml", "base.yml"].map(|f| dir.join(f).to_string_lossy().into_owned());
        std::fs::write(&root, "extends: ./base.yml\n").unwrap();
        std::fs::write(&base, "extends: ./.theme-check.yml\n").unwrap();
        let err = resolve_config(&root, true, &[])
            .err()
            .map(|e| e.to_string());
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(
            err.unwrap(),
            format!("Error: Cyclic extends in theme-check config: {root} -> {base} -> {root}")
        );
    }
}
