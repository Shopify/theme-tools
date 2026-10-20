//! Runs the language-neutral parser specs in specs/parser at the repo root, as
//! packages/liquid-html-parser does in TypeScript. Prints each failure, and fails when there's one.

use liquid_parser::ast::*;
use liquid_parser::{to_liquid_ast, to_liquid_html_ast, LineColumn, ParseError};
use serde_json::{json, Value};
use std::path::Path;
use yaml_rust2::{Yaml, YamlLoader};

/// A tree as the specs give it: TypeScript's properties, without the source on every node, and
/// with positions as text.
struct Tree<'s> {
    source: &'s str,
}

fn ws(b: bool) -> Value {
    json!(if b { "-" } else { "" })
}

impl Tree<'_> {
    /// `{ start: [line, character], text }`, the character in UTF-16 code units.
    fn pos(&self, p: Position) -> Value {
        let Some(text) = self.source.get(p.start..p.end) else {
            return json!(format!("{}..{} outside the source", p.start, p.end));
        };
        let before = &self.source[..p.start];
        let line_start = before.rfind('\n').map_or(0, |i| i + 1);
        json!({
            "start": [before.matches('\n').count(), before[line_start..].encode_utf16().count()],
            "text": text,
        })
    }

    fn nodes(&self, nodes: &[Node]) -> Value {
        nodes.iter().map(|n| self.node(n.to_ref())).collect()
    }

    fn args(&self, args: &[NamedArgument]) -> Value {
        args.iter()
            .map(|a| self.node(NodeRef::NamedArgument(a)))
            .collect()
    }

    fn markup(&self, m: &Markup) -> Value {
        match m {
            Markup::Str(s) => json!(s),
            Markup::Node(n) => self.node(n.to_ref()),
            Markup::Nodes(ns) => self.nodes(ns),
            Markup::Null => Value::Null,
        }
    }

    fn opt_node(&self, n: Option<NodeRef>) -> Value {
        n.map_or(Value::Null, |n| self.node(n))
    }

    fn node(&self, n: NodeRef) -> Value {
        use NodeRef as R;
        let mut v = match n {
            R::Document(n) => json!({ "name": "#document", "children": self.nodes(&n.children) }),
            R::YAMLFrontmatter(n) => json!({ "body": n.body }),
            R::LiquidRawTag(n) => json!({
                "name": n.name,
                "markup": n.markup,
                "markupPosition": self.pos(n.markup_position),
                "body": self.node(R::RawMarkup(&n.body)),
                "whitespaceStart": ws(n.whitespace_start),
                "whitespaceEnd": ws(n.whitespace_end),
                "delimiterWhitespaceStart": ws(n.delimiter_whitespace_start),
                "delimiterWhitespaceEnd": ws(n.delimiter_whitespace_end),
                "blockStartPosition": self.pos(n.block_start_position),
                "blockEndPosition": self.pos(n.block_end_position),
            }),
            R::LiquidTag(n) => {
                let mut v = json!({
                    "name": n.name,
                    "markup": self.markup(&n.markup),
                    "whitespaceStart": ws(n.whitespace_start),
                    "whitespaceEnd": ws(n.whitespace_end),
                    "blockStartPosition": self.pos(n.block_start_position),
                    "markupPosition": self.pos(n.markup_position),
                });
                if let Some(c) = &n.children {
                    v["children"] = self.nodes(c);
                }
                if let Some(b) = n.delimiter_whitespace_start {
                    v["delimiterWhitespaceStart"] = ws(b);
                }
                if let Some(b) = n.delimiter_whitespace_end {
                    v["delimiterWhitespaceEnd"] = ws(b);
                }
                if let Some(p) = n.block_end_position {
                    v["blockEndPosition"] = self.pos(p);
                }
                if let Some(r) = &n.reason {
                    v["reason"] = json!(r);
                }
                v
            }
            R::LiquidBranch(n) => json!({
                "name": n.name,
                "markup": self.markup(&n.markup),
                "children": self.nodes(&n.children),
                "whitespaceStart": ws(n.whitespace_start),
                "whitespaceEnd": ws(n.whitespace_end),
                "markupPosition": self.pos(n.markup_position),
                "blockStartPosition": self.pos(n.block_start_position),
                "blockEndPosition": self.pos(n.block_end_position),
            }),
            R::LiquidVariableOutput(n) => json!({
                "markup": self.markup(&n.markup),
                "whitespaceStart": ws(n.whitespace_start),
                "whitespaceEnd": ws(n.whitespace_end),
                "markupPosition": self.pos(n.markup_position),
            }),
            R::HtmlSelfClosingElement(n) => json!({
                "name": self.nodes(&n.name),
                "attributes": self.nodes(&n.attributes),
                "blockStartPosition": self.pos(n.block_start_position),
            }),
            R::HtmlVoidElement(n) => json!({
                "name": n.name,
                "attributes": self.nodes(&n.attributes),
                "blockStartPosition": self.pos(n.block_start_position),
            }),
            R::HtmlDoctype(n) => json!({ "legacyDoctypeString": n.legacy_doctype_string }),
            R::HtmlComment(n) => json!({ "body": n.body }),
            R::HtmlElement(n) => json!({
                "name": self.nodes(&n.name),
                "attributes": self.nodes(&n.attributes),
                "children": self.nodes(&n.children),
                "blockStartPosition": self.pos(n.block_start_position),
                "blockEndPosition": self.pos(n.block_end_position),
            }),
            R::HtmlDanglingMarkerClose(n) => json!({
                "name": self.nodes(&n.name),
                "blockStartPosition": self.pos(n.block_start_position),
            }),
            R::HtmlRawNode(n) => json!({
                "name": n.name,
                "attributes": self.nodes(&n.attributes),
                "body": self.node(R::RawMarkup(&n.body)),
                "blockStartPosition": self.pos(n.block_start_position),
                "blockEndPosition": self.pos(n.block_end_position),
            }),
            R::AttrSingleQuoted(n) | R::AttrDoubleQuoted(n) | R::AttrUnquoted(n) => json!({
                "name": self.nodes(&n.name),
                "value": self.nodes(&n.value),
                "attributePosition": self.pos(n.attribute_position),
            }),
            R::AttrEmpty(n) => json!({ "name": self.nodes(&n.name) }),
            R::TextNode(n) => json!({ "value": n.value }),
            R::LiquidVariable(n) => json!({
                "expression": self.node(n.expression.to_ref()),
                "filters": n.filters.iter().map(|f| self.node(R::LiquidFilter(f))).collect::<Value>(),
                "rawSource": n.raw_source,
            }),
            R::LiquidFilter(n) => json!({ "name": n.name, "args": self.nodes(&n.args) }),
            R::NamedArgument(n) => json!({ "name": n.name, "value": self.node(n.value.to_ref()) }),
            R::LiquidLiteral(n) => json!({
                "keyword": n.keyword,
                "value": match n.keyword {
                    "true" => json!(true),
                    "false" => json!(false),
                    "blank" | "empty" => json!(""),
                    _ => Value::Null,
                },
            }),
            R::BooleanExpression(n) => json!({ "condition": self.node(n.condition.to_ref()) }),
            R::String(n) => {
                let mut v = json!({ "value": n.value });
                if let Some(single) = n.single {
                    v["single"] = json!(single);
                }
                v
            }
            R::Number(n) => json!({ "value": n.value }),
            R::Range(n) => json!({
                "start": self.node(n.start.to_ref()),
                "end": self.node(n.end.to_ref()),
            }),
            R::VariableLookup(n) => {
                let mut v = json!({ "name": n.name, "lookups": self.nodes(&n.lookups) });
                if let Some(modes) = &n.lookup_modes {
                    v["lookupModes"] = modes
                        .iter()
                        .map(|m| match m {
                            LookupMode::Bareword => json!("bareword"),
                            LookupMode::Subscript => json!("subscript"),
                        })
                        .collect();
                }
                v
            }
            R::Comparison(n) => json!({
                "comparator": n.comparator,
                "left": self.node(n.left.to_ref()),
                "right": self.node(n.right.to_ref()),
            }),
            R::LogicalExpression(n) => json!({
                "relation": n.relation,
                "left": self.node(n.left.to_ref()),
                "right": self.node(n.right.to_ref()),
            }),
            R::AssignMarkup(n) => json!({
                "name": n.name,
                "value": self.node(R::LiquidVariable(&n.value)),
            }),
            R::BlockMarkup(n) | R::SectionMarkup(n) => json!({
                "name": self.node(R::String(&n.name)),
                "args": self.args(&n.args),
            }),
            R::ContentForMarkup(n) => json!({
                "contentForType": self.node(R::String(&n.content_for_type)),
                "args": self.args(&n.args),
            }),
            R::CycleMarkup(n) => json!({
                "groupName": self.opt_node(n.group_name.as_deref().map(Node::to_ref)),
                "args": self.nodes(&n.args),
            }),
            R::ForMarkup(n) => json!({
                "variableName": n.variable_name,
                "collection": self.node(n.collection.to_ref()),
                "reversed": n.reversed,
                "args": self.args(&n.args),
            }),
            R::PaginateMarkup(n) => json!({
                "collection": self.node(n.collection.to_ref()),
                "pageSize": self.node(n.page_size.to_ref()),
                "args": self.args(&n.args),
            }),
            R::RawMarkup(n) => json!({
                "kind": n.kind,
                "value": n.value,
                "nodes": self.nodes(&n.nodes),
            }),
            R::RenderMarkup(n) => json!({
                "snippet": self.node(n.snippet.to_ref()),
                "variable": self.opt_node(n.variable.as_ref().map(R::RenderVariableExpression)),
                "alias": self.opt_node(n.alias.as_ref().map(R::RenderAliasExpression)),
                "args": self.args(&n.args),
            }),
            R::RenderVariableExpression(n) => json!({
                "kind": n.kind,
                "name": self.node(n.name.to_ref()),
            }),
            R::RenderAliasExpression(n) => json!({ "value": n.value }),
            R::LiquidDocDescriptionNode(n) => json!({
                "name": "description",
                "content": self.node(R::TextNode(&n.content)),
                "isImplicit": n.is_implicit,
                "isInline": n.is_inline,
            }),
            R::LiquidDocParamNode(n) => json!({
                "name": "param",
                "paramName": self.node(R::TextNode(&n.param_name)),
                "paramType": self.opt_node(n.param_type.as_ref().map(R::TextNode)),
                "paramDescription": self.opt_node(n.param_description.as_ref().map(R::TextNode)),
                "required": n.required,
            }),
            R::LiquidDocExampleNode(n) => json!({
                "name": "example",
                "content": self.node(R::TextNode(&n.content)),
                "isInline": n.is_inline,
            }),
            R::LiquidDocPromptNode(n) => json!({
                "name": "prompt",
                "content": self.node(R::TextNode(&n.content)),
            }),
            R::LiquidErrorNode(_) => unreachable!("strict parsing never builds LiquidErrorNode"),
            R::BlockArrayLiteral(n) => json!({ "elements": self.nodes(&n.elements) }),
        };
        v["type"] = json!(n.type_name());
        v["position"] = self.pos(n.position());
        v
    }
}

/// `{ message, start, text }` at the error's `loc`, which TypeScript clamps to the template's
/// last character.
fn spec_error(source: &str, e: &ParseError) -> Value {
    let Some(loc) = e.loc else {
        // TypeScript throws a plain Error here, which no spec has.
        return json!(e.to_string());
    };
    let units: Vec<u16> = source.encode_utf16().collect();
    let line_starts: Vec<usize> = std::iter::once(0)
        .chain(
            (0..units.len())
                .filter(|&i| units[i] == b'\n' as u16)
                .map(|i| i + 1),
        )
        .collect();
    let offset = |lc: LineColumn| Some(line_starts.get(lc.line - 1)? + lc.column - 1);
    let text = offset(loc.start)
        .zip(offset(loc.end))
        .and_then(|(a, b)| units.get(a..b))
        .map_or_else(
            || format!("{loc:?} outside the source"),
            String::from_utf16_lossy,
        );
    json!({
        "message": e.message,
        "start": [loc.start.line - 1, loc.start.column - 1],
        "text": text,
    })
}

fn to_json(yaml: &Yaml) -> Value {
    match yaml {
        Yaml::String(s) => json!(s),
        Yaml::Integer(i) => json!(i),
        Yaml::Boolean(b) => json!(b),
        Yaml::Null => Value::Null,
        Yaml::Array(items) => items.iter().map(to_json).collect(),
        Yaml::Hash(map) => map
            .iter()
            .map(|(k, v)| (k.as_str().expect("string keys").to_string(), to_json(v)))
            .collect(),
        other => panic!("unexpected YAML {other:?}"),
    }
}

/// Where `actual` differs from `expected`, one line per property. Object keys are unordered.
fn diff(path: &str, expected: &Value, actual: &Value, out: &mut Vec<String>) {
    match (expected, actual) {
        (Value::Object(e), Value::Object(a)) => {
            for (k, v) in e {
                match a.get(k) {
                    Some(av) => diff(&format!("{path}.{k}"), v, av, out),
                    None => out.push(format!("{path}.{k}: missing")),
                }
            }
            for (k, v) in a.iter().filter(|(k, _)| !e.contains_key(*k)) {
                out.push(format!("{path}.{k}: unexpected {v}"));
            }
        }
        (Value::Array(e), Value::Array(a)) if e.len() == a.len() => {
            for (i, (e, a)) in e.iter().zip(a).enumerate() {
                diff(&format!("{path}.{i}"), e, a, out);
            }
        }
        _ if expected != actual => out.push(format!("{path}: expected {expected}, got {actual}")),
        _ => {}
    }
}

/// specs/parser/*.yml, format in its README.md.
fn main() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../specs/parser");
    let mut paths: Vec<_> = std::fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("{}: {e}", dir.display()))
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|x| x == "yml"))
        .collect();
    paths.sort();
    let (mut total, mut failed) = (0, 0);
    for path in paths {
        let file = path.file_name().unwrap().to_string_lossy().into_owned();
        let docs = YamlLoader::load_from_str(&std::fs::read_to_string(&path).unwrap())
            .unwrap_or_else(|e| panic!("{file}: {e}"));
        let spec = to_json(&docs[0]);
        for case in spec["cases"].as_array().expect("a spec has cases") {
            total += 1;
            let source = case["source"].as_str().expect("a case has a source");
            let expected = match (case.get("ast"), case.get("error")) {
                (Some(ast), None) => json!({ "ast": ast }),
                (None, Some(error)) => json!({ "error": error }),
                _ => panic!("{file}: {} needs one of ast and error", case["name"]),
            };
            let mut problems = Vec::new();
            for parse in case["parse"].as_array().expect("a case has parses") {
                let result = match parse.as_str() {
                    Some("html") => to_liquid_html_ast(source),
                    Some("liquid") => to_liquid_ast(source),
                    _ => panic!("{file}: unknown parse {parse}"),
                };
                let actual = match result {
                    Ok(doc) => json!({ "ast": Tree { source }.node(NodeRef::Document(&doc)) }),
                    Err(e) => json!({ "error": spec_error(source, &e) }),
                };
                diff(parse.as_str().unwrap(), &expected, &actual, &mut problems);
            }
            if !problems.is_empty() {
                failed += 1;
                println!("FAIL parser/{file}: {}", case["name"].as_str().unwrap());
                problems.iter().for_each(|p| println!("  {p}"));
            }
        }
    }
    println!("specs/parser: {} of {total} passing", total - failed);
    std::process::exit(i32::from(failed > 0));
}
