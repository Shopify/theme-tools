//! `to-schema.ts`.

use crate::context::{Context, Mode};
use crate::json::{parse_json, parse_json_strict, to_json_node, JsonNode};
use crate::json_validator::JsonValidator;
use crate::path;
use crate::source::{Ast, SourceCode};
use crate::visitor::walk;
use liquid_ast::{LiquidRawTag, Markup, Node, NodeRef};
use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SchemaKind {
    Block,
    Section,
    AppBlock,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StaticBlockDef {
    pub block_type: String,
    pub id: String,
}

/// TS `ThemeBlockSchema` / `SectionSchema` / `AppBlockSchema`. Errors are the TS Error messages.
pub struct ThemeSchema<'a> {
    pub kind: SchemaKind,
    /// `basename(uri, '.liquid')`
    pub name: String,
    /// The `{% schema %}` body's JSON AST. Locs are relative to `offset`.
    pub ast: Result<JsonNode<'a>, String>,
    /// Strict `parseJSON` of the body. `Ok(None)` can't happen in practice (strict parsing of
    /// empty content errors) but mirrors `undefined`.
    pub parsed: Result<Option<Value>, String>,
    /// `{% schema %}`'s `blockStartPosition.end` (byte offset in the Liquid file), 0 if none.
    pub offset: usize,
    /// The schema body, `''` if none.
    pub value: &'a str,
    /// Empty for app blocks.
    pub static_block_defs: Vec<StaticBlockDef>,
    /// `validSchema` when it isn't `parsed`: a replayed mock (`replay.rs`) or `isValidSchema`
    /// saying no. `None` = `parsed`.
    pub valid: Option<Result<Option<Value>, String>>,
}

const NO_SCHEMA_TAG: &str = "No schema tag found";

impl<'a> ThemeSchema<'a> {
    /// `validSchema`. `None` for app blocks (TS `undefined`).
    pub fn valid_schema(&self) -> Option<Result<&Option<Value>, &str>> {
        match self.kind {
            SchemaKind::AppBlock => None,
            _ => Some(
                self.valid
                    .as_ref()
                    .unwrap_or(&self.parsed)
                    .as_ref()
                    .map_err(String::as_str),
            ),
        }
    }

    /// `validSchema` when it's a value (TS `validSchema && !(validSchema instanceof Error)`).
    pub fn valid_value(&self) -> Option<&Value> {
        self.valid_schema()?.ok()?.as_ref()
    }

    /// `hasNoSchemaTag(schema)`
    pub fn has_no_schema_tag(&self) -> bool {
        matches!(&self.parsed, Err(e) if e == NO_SCHEMA_TAG)
    }

    /// `ast` when it's a node.
    pub fn ast(&self) -> Option<&JsonNode<'a>> {
        self.ast.as_ref().ok()
    }
}

/// `isBlock(uri)`
pub fn is_block(uri: &str) -> bool {
    path::dirname(uri).ends_with("blocks")
}

/// `isSection(uri)`
pub fn is_section(uri: &str) -> bool {
    path::dirname(uri).ends_with("sections")
}

/// `isSnippet(uri)`
pub fn is_snippet(uri: &str) -> bool {
    path::dirname(uri).ends_with("snippets")
}

/// `toSchema(mode, uri, sourceCode, isValidSchema)` with an always-true validator (the spec
/// test-helper's).
pub fn to_schema<'a>(mode: Mode, file: &'a SourceCode<'a>) -> Option<ThemeSchema<'a>> {
    to_schema_with(mode, file, None)
}

/// `toSchema(mode, uri, sourceCode, validator.isValid)`; `None` is always-true.
pub fn to_schema_with<'a>(
    mode: Mode,
    file: &'a SourceCode<'a>,
    validator: Option<&JsonValidator>,
) -> Option<ThemeSchema<'a>> {
    let Ast::Liquid(liquid) = &file.ast else {
        return None;
    };
    let kind = match mode {
        Mode::App if is_block(&file.uri) => SchemaKind::AppBlock,
        Mode::Theme if is_block(&file.uri) => SchemaKind::Block,
        Mode::Theme if is_section(&file.uri) => SchemaKind::Section,
        _ => return None,
    };
    let schema_node: Result<&'a LiquidRawTag<'a>, String> = match liquid {
        Err(e) => Err(e.message.clone()),
        Ok(doc) => walk(NodeRef::Document(doc))
            .find_map(|n| match n {
                NodeRef::LiquidRawTag(t) if t.name == "schema" => Some(t),
                _ => None,
            })
            .ok_or_else(|| NO_SCHEMA_TAG.to_string()),
    };
    let static_block_defs = match (kind, liquid) {
        (SchemaKind::AppBlock, _) | (_, Err(_)) => Vec::new(),
        (_, Ok(doc)) => static_block_defs(NodeRef::Document(doc)),
    };
    let (ast, parsed, offset, value, valid) = match schema_node {
        Err(e) => (Err(e.clone()), Err(e), 0, "", None),
        Ok(tag) => {
            let value: &'a str = &tag.body.value;
            let ast =
                to_json_node(value).map_err(|_| crate::json::JsonParseErrors::MESSAGE.to_string());
            let parsed = parse_json_strict(value).map_err(str::to_string);
            // toValidSchema (not called for app blocks). ponytail: a validator that throws (a broken
            // `$ref`, an unknown `$schema`) also reads as invalid; TS rejects `toSchema` instead.
            let invalid = kind != SchemaKind::AppBlock
                && validator.is_some_and(|v| !v.is_valid(&file.uri, value).unwrap_or(false));
            (
                ast,
                parsed,
                tag.block_start_position.end,
                value,
                invalid.then(|| Err("Invalid schema".to_string())),
            )
        }
    };
    Some(ThemeSchema {
        kind,
        name: path::basename(&file.uri, Some(".liquid")),
        ast,
        parsed,
        offset,
        value,
        static_block_defs,
        valid,
    })
}

/// `toStaticBlockDefs(ast)`: `{% content_for 'block', type: '...', id: '...' %}` with string args.
fn static_block_defs(root: NodeRef) -> Vec<StaticBlockDef> {
    walk(root)
        .filter_map(|n| {
            let NodeRef::LiquidTag(tag) = n else {
                return None;
            };
            if tag.name != "content_for" {
                return None;
            }
            let Markup::Node(markup) = &tag.markup else {
                return None;
            };
            let Node::ContentForMarkup(m) = markup.as_ref() else {
                return None;
            };
            if m.content_for_type.value != "block" {
                return None;
            }
            let arg = |name: &str| m.args.iter().find(|a| a.name == name);
            let (Node::String(t), Node::String(id)) =
                (arg("type")?.value.as_ref(), arg("id")?.value.as_ref())
            else {
                return None;
            };
            Some(StaticBlockDef {
                block_type: t.value.to_string(),
                id: id.value.to_string(),
            })
        })
        .collect()
}

/// `getSchema(context)`
pub fn get_schema<'a>(cx: &Context<'a>) -> Option<&'a ThemeSchema<'a>> {
    cx.get_schema()
}

/// `getSchemaFromJSON(context)`: the file's tolerant `parseJSON` value (`None` = `undefined`) and
/// its AST.
pub fn get_schema_from_json<'a>(cx: &Context<'a>) -> (Option<Value>, Option<&'a JsonNode<'a>>) {
    (parse_json(cx.source()), cx.file.json_ast())
}
