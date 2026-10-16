//! Rust/WASM backend for `@shopify/liquid-html-parser`.
//!
//! `rust/register.mjs` instantiates this module and registers `parse` as the
//! parser backend. The `replay_*` exports belong to the marshalling gate and
//! are never called by `parse`. The `debug_*` exports are test-only, and are
//! never called by `parse` either: `debug_tokenize` and
//! `debug_tokenize_markup` for `scripts/rust-parity-tokens.ts`, and
//! `debug_parse_tag` and `debug_parse_liquid_doc` for
//! `scripts/rust-parity-markup.ts`.

use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

mod ast;
mod errors;
mod gate;
mod js;
mod offsets;
mod tag_definitions;
mod types;
mod value;
mod wire;

mod document {
    pub mod tokenizer;
}

mod liquid_doc {
    pub mod factories;
    pub mod parser;
    pub mod tokenizer;
}

mod markup {
    pub mod expression_adapter;
    pub mod parser;
    pub mod tokenizer;
}

mod tags {
    pub mod assign;
    pub mod block;
    pub mod r#break;
    pub mod capture;
    pub mod case;
    pub mod content_for;
    pub mod r#continue;
    pub mod cycle;
    pub mod decrement;
    pub mod echo;
    pub mod r#for;
    pub mod form;
    pub mod r#if;
    pub mod ifchanged;
    pub mod increment;
    pub mod index;
    pub mod layout;
    pub mod liquid;
    pub mod paginate;
    pub mod partial;
    pub mod raw;
    pub mod render;
    pub mod section;
    pub mod sections;
}

pub use gate::{replay_emit_json, replay_emit_object, replay_load};

use ast::LiquidStatement;
use errors::ParseError;
use markup::parser::MarkupParser;
use markup::tokenizer::MarkupToken;
use offsets::Utf16Offsets;
use tag_definitions::{LiquidLineContext, Parser};
use value::{JsVal, obj};

/// Backend parse entry point.
///
/// Returns one JSON string holding the whole backend result, `{ok, ast}` or
/// `{ok: false, error}`, in the backend wire format that `src/backend.ts`
/// hydrates. Throws for a kind that is not ported yet.
#[wasm_bindgen]
pub fn parse(
    kind: &str,
    _source: &str,
    _allow_unclosed_document_node: bool,
) -> Result<String, JsError> {
    Err(JsError::new(&format!(
        "Rust parser is not ported yet: cannot parse kind '{kind}'"
    )))
}

/// Test-only: the document tokens of `source` as a JSON array of
/// `{type, start, end}`, with UTF-16 offsets, as TS `tokenize` returns them.
#[wasm_bindgen]
pub fn debug_tokenize(
    source: &str,
    skip_frontmatter: bool,
    inside_quoted_attribute: Option<String>,
    inside_html_tag: bool,
) -> String {
    let options = document::tokenizer::TokenizeOptions {
        skip_frontmatter,
        inside_quoted_attribute,
        inside_html_tag,
    };
    let offsets = Utf16Offsets::new(source);
    let tokens: Vec<Value> = document::tokenizer::tokenize(source, &options)
        .iter()
        .map(|token| {
            json!({
                "type": token.kind.as_str(),
                "start": offsets.utf16(token.start),
                "end": offsets.utf16(token.end),
            })
        })
        .collect();
    Value::Array(tokens).to_string()
}

/// Test-only: the markup tokens of `markup` as a JSON array of
/// `{type, value, start, end}`, with UTF-16 offsets plus `start_offset`, as TS
/// `tokenizeMarkup(markup, startOffset)` returns them.
#[wasm_bindgen]
pub fn debug_tokenize_markup(markup: &str, start_offset: u32) -> String {
    let offsets = Utf16Offsets::new(markup);
    let shift = start_offset as usize;
    let tokens: Vec<Value> = markup::tokenizer::tokenize_markup(markup)
        .iter()
        .map(|token| {
            json!({
                "type": token.kind.as_str(),
                "value": token.value,
                "start": offsets.utf16(token.start) + shift,
                "end": offsets.utf16(token.end) + shift,
            })
        })
        .collect();
    Value::Array(tokens).to_string()
}

/// The tag `Parser` for `debug_parse_tag`. There is no document parser before
/// 5c, so a `{% liquid %}` callback fails, as the TS script's stub does.
struct StubParser;

impl Parser for StubParser {
    fn parse_liquid_statement(
        &mut self,
        _tag_name: &str,
        _markup_string: &str,
        _start_offset: usize,
        _ctx: &mut LiquidLineContext,
    ) -> Result<LiquidStatement, ParseError> {
        Err(ParseError::error("rust-parity stub: no document parser"))
    }
}

/// The markup tokens of `source[start..end]`, with offsets shifted to the
/// source, as TS `tokenizeMarkup(markup, start)` returns them.
fn source_markup_tokens(source: &str, start: usize, end: usize) -> Vec<MarkupToken<'_>> {
    markup::tokenizer::tokenize_markup(&source[start..end])
        .into_iter()
        .map(|token| MarkupToken {
            start: token.start + start,
            end: token.end + start,
            ..token
        })
        .collect()
}

/// Test-only: runs the builtin tag `tag_name` on `source[markup_start..
/// markup_end]`, as `document/liquid-tags.ts` does. The offsets are UTF-16.
/// Returns the wire result of `{markup, atEnd}`.
#[wasm_bindgen]
pub fn debug_parse_tag(
    source: &str,
    tag_name: &str,
    markup_start: u32,
    markup_end: u32,
    tolerant: bool,
) -> Result<String, JsError> {
    let offsets = Utf16Offsets::new(source);
    let start = offsets.byte(markup_start as usize);
    let end = offsets.byte(markup_end as usize);
    let (Some(start), Some(end)) = (start, end) else {
        return Err(JsError::new("markup offsets are not character boundaries"));
    };
    if start > end {
        return Err(JsError::new("markup_start is after markup_end"));
    }
    let Some(definition) = tags::index::builtin_tag(tag_name) else {
        return Err(JsError::new(&format!("'{tag_name}' is not a builtin tag")));
    };

    let tokens = source_markup_tokens(source, start, end);
    let mut markup = MarkupParser::new(tokens, source, Some(start), Some(end));
    if tolerant {
        markup.enable_tolerant();
    }
    let result = definition.parse()(tag_name, &mut markup, &mut StubParser).map(|value| {
        obj! {
            "markup" => value,
            "atEnd" => JsVal::Bool(markup.is_at_end()),
        }
    });
    Ok(wire::emit_result(&result, &offsets))
}

/// Test-only: parses the LiquidDoc body `source[body_start..body_end]`, as
/// `document/liquid-raw.ts` does for a `doc` tag. The offsets are UTF-16.
/// Returns the wire result of the node array.
#[wasm_bindgen]
pub fn debug_parse_liquid_doc(
    source: &str,
    body_start: u32,
    body_end: u32,
) -> Result<String, JsError> {
    let offsets = Utf16Offsets::new(source);
    let start = offsets.byte(body_start as usize);
    let end = offsets.byte(body_end as usize);
    let (Some(start), Some(end)) = (start, end) else {
        return Err(JsError::new("body offsets are not character boundaries"));
    };
    if start > end {
        return Err(JsError::new("body_start is after body_end"));
    }

    let result =
        liquid_doc::parser::parse_liquid_doc(&source[start..end], start, source).map(JsVal::array);
    Ok(wire::emit_result(&result, &offsets))
}
