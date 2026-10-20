use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::{parse_json, truthy};
use liquid_ast::{Node, NodeKind, NodeRef};
use serde_json::Value;

pub static TRANSLATION_KEY_EXISTS: CheckDef = CheckDef {
    code: "TranslationKeyExists",
    name: "Reports missing translation keys",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

#[derive(Default)]
struct Check<'a> {
    nodes: Vec<(&'a str, usize, usize)>,
    /// `schema.locales?.[defaultLocale]`, `None` = `undefined`.
    schema_locales: Option<Value>,
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

/// Stands in for an array's `length`: not an object, so the walk ends there.
static LENGTH: Value = Value::Bool(false);

/// `pointer.hasOwnProperty(token)` on an array: a canonical index in range, or `length`.
fn array_has_own(a: &[Value], token: &str) -> bool {
    token == "length"
        || (!token.is_empty()
            && token.bytes().all(|c| c.is_ascii_digit())
            && (token == "0" || !token.starts_with('0'))
            && token.parse::<usize>().is_ok_and(|i| i < a.len()))
}

/// `keyExists(key, pointer)`
fn key_exists(key: &str, mut pointer: Option<&Value>) -> Result<bool, CheckError> {
    for token in key.split('.') {
        pointer = match pointer {
            // typeof pointer !== 'object'
            None | Some(Value::Bool(_) | Value::Number(_) | Value::String(_)) => return Ok(false),
            Some(Value::Null) => {
                return Err(CheckError::new(
                    "Cannot read properties of null (reading 'hasOwnProperty')",
                ))
            }
            Some(Value::Object(m)) if m.contains_key("hasOwnProperty") => {
                return Err(CheckError::new("pointer.hasOwnProperty is not a function"))
            }
            Some(Value::Object(m)) => match m.get(token) {
                Some(v) => Some(v),
                None => return Ok(false),
            },
            Some(Value::Array(a)) if !array_has_own(a, token) => return Ok(false),
            // `length` reads a number, which ends the walk.
            Some(Value::Array(a)) => Some(
                a.get(token.parse::<usize>().unwrap_or(usize::MAX))
                    .unwrap_or(&LENGTH),
            ),
        };
    }
    Ok(true)
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidVariable.bit() | NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::LiquidVariable(v) => {
                let Node::String(expression) = v.expression.as_ref() else {
                    return Ok(());
                };
                if v.filters
                    .iter()
                    .any(|f| f.name == "t" || f.name == "translate")
                {
                    self.nodes.push((
                        &expression.value,
                        expression.position.start,
                        expression.position.end,
                    ));
                }
            }
            NodeRef::LiquidRawTag(tag) => {
                if tag.name != "schema" || tag.body.kind != "json" {
                    return Ok(());
                }
                let locale = cx.default_locale();
                self.schema_locales = match parse_json(&tag.body.value) {
                    None => {
                        return Err(CheckError::new(
                            "Cannot read properties of undefined (reading 'locales')",
                        ))
                    }
                    Some(Value::Null) => {
                        return Err(CheckError::new(
                            "Cannot read properties of null (reading 'locales')",
                        ))
                    }
                    Some(Value::Object(mut m)) => match m.remove("locales") {
                        Some(Value::Object(mut l)) => l.remove(locale),
                        Some(Value::Array(mut a))
                            if array_has_own(&a, locale) && locale != "length" =>
                        {
                            Some(a.swap_remove(locale.parse().unwrap()))
                        }
                        _ => None,
                    },
                    Some(_) => None,
                };
            }
            _ => {}
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let default_translations = cx.default_translations();
        let system_translations = cx.docset().map(|d| &d.system_translations);
        if !default_translations.is_some_and(truthy)
            && system_translations.map_or(true, |s| s.is_empty())
        {
            return Ok(());
        }
        let locale = cx.default_locale();
        for &(key, start, end) in &self.nodes {
            if key_exists(key, default_translations)?
                || key_exists(key, self.schema_locales.as_ref())?
                || system_translations.is_some_and(|s| s.contains_key(key))
            {
                continue;
            }
            let mut message = format!(
                "'{key}' does not have a matching entry in 'locales/{locale}.default.json'"
            );
            if self.schema_locales.as_ref().is_some_and(truthy) {
                message.push_str(&format!(" or '{}'", cx.to_relative_path(cx.uri())));
            }
            cx.report(message, start, end);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn key_exists_like_js() {
        let v = json!({ "a": { "b": [1, { "c": 2 }] }, "n": null });
        assert!(key_exists("a.b.1.c", Some(&v)).unwrap());
        assert!(key_exists("a.b.length", Some(&v)).unwrap());
        assert!(!key_exists("a.b.01", Some(&v)).unwrap());
        assert!(!key_exists("a.b.length.x", Some(&v)).unwrap());
        assert!(!key_exists("a.x", Some(&v)).unwrap());
        assert!(key_exists("n", Some(&v)).unwrap());
        assert!(key_exists("n.x", Some(&v)).is_err());
        assert!(!key_exists("a", None).unwrap());
    }
}
