use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, JsonCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use crate::json::{JsonKind, JsonNode, JsonRef, Loc, PropertyNode};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub static MATCHING_TRANSLATIONS: CheckDef = CheckDef {
    code: "MatchingTranslations",
    name: "Translation files should have the same keys",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Json(create),
};

const PLURALIZATION_KEYS: &[&str] = &["zero", "one", "two", "few", "many", "other"];

struct Check<'a> {
    ast: &'a JsonNode<'a>,
    is_schema_translation_file: bool,
    default_translations: HashSet<String>,
    /// A JS Set: insertion order, deletions remove.
    missing: Vec<String>,
    missing_set: HashSet<String>,
    /// A JS Map: (path, latest node), in first-insertion order.
    nodes_by_path: Vec<(String, &'a PropertyNode<'a>)>,
    path_index: HashMap<String, usize>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    let uri = cx.uri();
    let is_locale_file = cx.to_relative_path(uri).starts_with("locales/");
    let is_default = uri.ends_with(".default.json") || uri.ends_with(".default.schema.json");
    let ast = cx.file.json_ast()?;
    if !is_locale_file || is_default {
        return None;
    }
    Some(Box::new(Check {
        ast,
        is_schema_translation_file: uri.ends_with(".schema.json"),
        default_translations: HashSet::new(),
        missing: Vec::new(),
        missing_set: HashSet::new(),
        nodes_by_path: Vec::new(),
        path_index: HashMap::new(),
    }))
}

/// `jsonPaths(json)`: leaf paths, recursing into anything `typeof 'object'` (so `null` throws).
/// `prefix` is `None` at the top level (keys can be empty strings).
fn json_paths(
    json: Option<&Value>,
    out: &mut Vec<String>,
    prefix: Option<&str>,
) -> Result<(), CheckError> {
    let join = |key: &str| prefix.map_or_else(|| key.to_string(), |p| format!("{p}.{key}"));
    match json {
        None | Some(Value::Null) => {
            return Err(CheckError::new(
                "Cannot convert undefined or null to object",
            ))
        }
        Some(Value::Object(m)) => {
            for (k, v) in m {
                let path = join(k);
                match v {
                    Value::Object(_) | Value::Array(_) | Value::Null => {
                        json_paths(Some(v), out, Some(&path))?
                    }
                    _ => out.push(path),
                }
            }
        }
        Some(Value::Array(a)) => {
            for (i, v) in a.iter().enumerate() {
                let path = join(&i.to_string());
                match v {
                    Value::Object(_) | Value::Array(_) | Value::Null => {
                        json_paths(Some(v), out, Some(&path))?
                    }
                    _ => out.push(path),
                }
            }
        }
        // Object.keys of a string: one key per UTF-16 unit, each a one-char string leaf.
        Some(Value::String(s)) => {
            (0..s.encode_utf16().count()).for_each(|i| out.push(join(&i.to_string())))
        }
        Some(_) => {}
    }
    Ok(())
}

fn is_external_path(path: &str) -> bool {
    path.starts_with("shopify.") || path.starts_with("customer_accounts.")
}

fn is_pluralization_path(path: &str) -> bool {
    PLURALIZATION_KEYS.iter().any(|k| path.ends_with(k))
}

impl<'a> Check<'a> {
    /// `closestTranslationKey(key)`: the node of the path sharing the most leading parts.
    fn closest(&self, key: &str) -> Loc {
        let key_parts: Vec<&str> = key.split('.').collect();
        let mut best: Option<&PropertyNode> = None;
        let mut max = 0;
        for (path, node) in &self.nodes_by_path {
            let common = path
                .split('.')
                .zip(&key_parts)
                .take_while(|(a, b)| a == *b)
                .count();
            if common > max {
                max = common;
                best = Some(node);
            }
        }
        // `nodesByPath.get(closestMatch ?? '') ?? ast` (a top-level `""` key has path '').
        best.or_else(|| self.path_index.get("").map(|&i| self.nodes_by_path[i].1))
            .map_or(self.ast.loc(), |n| n.loc)
    }
}

impl<'a> JsonCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        JsonKind::Property.bit()
    }

    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let defaults = if self.is_schema_translation_file {
            cx.default_schema_translations()
        } else {
            cx.default_translations()
        };
        let mut paths = Vec::new();
        json_paths(defaults, &mut paths, None)?;
        for p in paths {
            self.default_translations.insert(p.clone());
            if self.missing_set.insert(p.clone()) {
                self.missing.push(p);
            }
        }
        Ok(())
    }

    fn node(
        &mut self,
        node: JsonRef<'a>,
        ancestors: &[JsonRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        let JsonRef::Property(prop) = node else {
            return Ok(());
        };
        // objectPath(ancestors.concat(node))
        let keys: Vec<&str> = ancestors
            .iter()
            .chain([&node])
            .filter_map(|a| match a {
                JsonRef::Property(p) => Some(p.key.value.as_ref()),
                _ => None,
            })
            .collect();
        let path = keys.join(".");
        match self.path_index.get(&path) {
            Some(&i) => self.nodes_by_path[i].1 = prop,
            None => {
                self.path_index
                    .insert(path.clone(), self.nodes_by_path.len());
                self.nodes_by_path.push((path.clone(), prop));
            }
        }

        if self.default_translations.is_empty()
            || PLURALIZATION_KEYS.contains(&prop.key.value.as_ref())
            || !matches!(prop.value, JsonNode::Literal(_))
            || is_external_path(&path)
        {
            return Ok(());
        }
        if self.default_translations.contains(&path) {
            self.missing_set.remove(&path);
            return Ok(());
        }
        let suggest = vec![Suggestion::new(
            "Delete unneeded translation key",
            Fix::json_remove(path.as_str()),
        )];
        cx.report_with(
            format!("A default translation for '{path}' does not exist"),
            prop.loc.start,
            prop.loc.end,
            None,
            Some(suggest),
        );
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        for path in &self.missing {
            if !self.missing_set.contains(path)
                || is_pluralization_path(path)
                || is_external_path(path)
            {
                continue;
            }
            let loc = self.closest(path);
            let fix = Fix::json_add(path.as_str(), Value::from("TODO"));
            cx.report_with(
                format!("The translation for '{path}' is missing"),
                loc.start,
                loc.end,
                Some(fix),
                None,
            );
        }
        Ok(())
    }
}
