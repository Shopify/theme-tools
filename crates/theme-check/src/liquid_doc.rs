//! `liquid-doc/liquidDoc.ts` and the parts of `liquid-doc/utils.ts` / `doc-param-type.ts` that
//! more than one check uses.

use crate::js;
use crate::schema::{is_block, is_snippet};
use crate::visitor::walk;
use liquid_ast::{Document, NodeRef};

#[derive(Clone, Debug, PartialEq)]
pub struct LiquidDocParameter {
    pub name: String,
    pub description: Option<String>,
    pub type_: Option<String>,
    pub required: bool,
}

/// TS `DocContent`. Empty lists / `None` stand for omitted keys.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct DocContent {
    pub parameters: Vec<LiquidDocParameter>,
    /// `examples[].content`
    pub examples: Vec<String>,
    /// `description?.content`
    pub description: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DocDefinition {
    pub uri: String,
    /// `Some` iff the file has a `{% doc %}` tag.
    pub liquid_doc: Option<DocContent>,
}

/// `hasLiquidDoc(ast)`
pub fn has_liquid_doc(ast: &Document) -> bool {
    walk(NodeRef::Document(ast)).any(|n| matches!(n, NodeRef::LiquidRawTag(t) if t.name == "doc"))
}

/// `extractDocDefinition(uri, ast)`
pub fn extract_doc_definition(uri: &str, ast: &Document) -> DocDefinition {
    let mut has_doc_tag = false;
    let mut doc = DocContent::default();
    for n in walk(NodeRef::Document(ast)) {
        match n {
            NodeRef::LiquidRawTag(t) if t.name == "doc" => has_doc_tag = true,
            NodeRef::LiquidDocParamNode(p) => doc.parameters.push(LiquidDocParameter {
                name: p.param_name.value.to_string(),
                description: p.param_description.as_ref().map(|d| d.value.to_string()),
                type_: p.param_type.as_ref().map(|t| t.value.to_string()),
                required: p.required,
            }),
            NodeRef::LiquidDocExampleNode(e) => doc
                .examples
                .push(handle_multiline_indentation(js::trim(&e.content.value))),
            NodeRef::LiquidDocDescriptionNode(d) if doc.description.is_none() => {
                doc.description = Some(handle_multiline_indentation(js::trim(&d.content.value)))
            }
            _ => {}
        }
    }
    DocDefinition {
        uri: uri.to_string(),
        liquid_doc: has_doc_tag.then_some(doc),
    }
}

/// Strips the common indentation of every line after the first.
fn handle_multiline_indentation(text: &str) -> String {
    let lines: Vec<&str> = text.split('\n').collect();
    if lines.len() <= 1 {
        return text.to_string();
    }
    let indent = |l: &str| l.chars().take_while(|&c| js::is_space(c)).count();
    let Some(min) = lines[1..]
        .iter()
        .filter(|l| !js::trim(l).is_empty())
        .map(|l| indent(l))
        .min()
    else {
        return text.to_string();
    };
    let mut out = lines[0].to_string();
    for l in &lines[1..] {
        out.push('\n');
        // Every non-blank line starts with at least `min` single-unit whitespace chars.
        if js::trim(l).is_empty() {
            out.push_str(l);
        } else {
            out.extend(l.chars().skip(min));
        }
    }
    out
}

/// `filePathSupportsLiquidDoc(uri)`
pub fn file_path_supports_liquid_doc(uri: &str) -> bool {
    is_snippet(uri) || is_block(uri)
}

/// TS `StringLiteralType`: `value` without quotes, `raw` with them.
#[derive(Clone, Debug, PartialEq)]
pub struct StringLiteral<'s> {
    pub value: &'s str,
    pub raw: &'s str,
}

/// `parseStringLiterals(type)`: `'a' | "b"`, or `None` unless the whole annotation is literals.
pub fn parse_string_literals(ty: &str) -> Option<Vec<StringLiteral<'_>>> {
    if ty.contains(['\r', '\n']) {
        return None;
    }
    let b = ty.as_bytes();
    let mut out = Vec::new();
    let mut pos = 0;
    let skip_ws = |pos: &mut usize| {
        while *pos < b.len() && (b[*pos] == b' ' || b[*pos] == b'\t') {
            *pos += 1;
        }
    };
    while pos < b.len() {
        skip_ws(&mut pos);
        let quote = *b.get(pos)?;
        if quote != b'\'' && quote != b'"' {
            return None;
        }
        let end = pos + 1 + ty[pos + 1..].find(quote as char)?;
        out.push(StringLiteral {
            value: &ty[pos + 1..end],
            raw: &ty[pos..=end],
        });
        pos = end + 1;
        skip_ws(&mut pos);
        if pos == b.len() {
            return Some(out);
        }
        if b[pos] != b'|' {
            return None;
        }
        pos += 1;
    }
    None
}

/// `parseParamTypeSyntax(value)`: `^([a-z_]+)(\[\])?$` → (base type, is array).
pub fn parse_param_type_syntax(value: &str) -> Option<(&str, bool)> {
    let (base, is_array) = match value.strip_suffix("[]") {
        Some(b) => (b, true),
        None => (value, false),
    };
    (!base.is_empty() && base.bytes().all(|c| c.is_ascii_lowercase() || c == b'_'))
        .then_some((base, is_array))
}

/// `normalizeNamedParamType(value)`: lowercased, if it's valid named-type syntax.
pub fn normalize_named_param_type(value: &str) -> Option<String> {
    let lower = value.to_lowercase();
    parse_param_type_syntax(&lower).is_some().then_some(lower)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn helpers() {
        assert_eq!(
            handle_multiline_indentation("a\n    b\n\n  c"),
            "a\n  b\n\nc"
        );
        let lits = parse_string_literals(" 'a' | \"b\" ").unwrap();
        assert_eq!(
            lits,
            vec![
                StringLiteral {
                    value: "a",
                    raw: "'a'"
                },
                StringLiteral {
                    value: "b",
                    raw: "\"b\""
                }
            ]
        );
        assert!(parse_string_literals("'a' |").is_none());
        assert!(parse_string_literals("").is_none());
        assert_eq!(
            parse_param_type_syntax("product[]"),
            Some(("product", true))
        );
        assert_eq!(
            normalize_named_param_type("Product"),
            Some("product".into())
        );
        assert_eq!(normalize_named_param_type("a b"), None);
    }
}
