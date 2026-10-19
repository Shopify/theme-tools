//! Rust/WASM backend for `@shopify/liquid-html-parser`.
//!
//! `rust/register.mjs` instantiates this module and registers `parse` as the
//! parser backend. The `replay_*` exports belong to the marshalling gate and
//! are never called by `parse`. The `debug_*` exports are test-only, and are
//! never called by `parse` either: `debug_tokenize` and
//! `debug_tokenize_markup` for `scripts/rust-parity-tokens.ts`, and
//! `debug_parse_tag` and `debug_parse_liquid_doc` for
//! `scripts/rust-parity-markup.ts`, and `debug_js` for
//! `scripts/rust-parity-js.ts`.

use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

mod ast;
mod environment;
mod errors;
mod gate;
mod grammar;
mod js;
mod offsets;
mod tag_definitions;
mod types;
mod value;
mod wire;

mod document {
    pub mod base;
    pub mod factories;
    pub mod html;
    pub mod liquid_blocks;
    pub mod liquid_lines;
    pub mod liquid_raw;
    pub mod liquid_tags;
    pub mod liquid_variable_output;
    pub mod node_dispatch;
    pub mod parser;
    pub mod tokenizer;
    pub mod tolerant_parser;
    pub mod tree_builder;
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
use markup::tokenizer::tokenize_markup_at;
use offsets::Utf16Offsets;
use tag_definitions::{LiquidLineContext, Parser};
use value::{JsVal, obj};

/// Backend parse entry point.
///
/// Returns one JSON string holding the whole backend result, `{ok, ast}` or
/// `{ok: false, error}`, in the backend wire format that `src/backend.ts`
/// hydrates. `liquidHtml` and `tolerantLiquidHtml` parse HTML, and `liquid`
/// and `tolerantLiquid` do not, as TS `toLiquidHtmlAST`, `toLiquidAST`,
/// `toTolerantLiquidHtmlAST` and `toTolerantLiquidAST` do. Throws for any
/// other kind.
#[wasm_bindgen]
pub fn parse(
    kind: &str,
    source: &str,
    allow_unclosed_document_node: bool,
) -> Result<String, JsError> {
    let (parse_html, tolerant) = match kind {
        "liquidHtml" => (true, false),
        "liquid" => (false, false),
        "tolerantLiquidHtml" => (true, true),
        "tolerantLiquid" => (false, true),
        _ => {
            return Err(JsError::new(&format!(
                "Rust parser: unknown parse kind '{kind}'"
            )));
        }
    };
    let tokens =
        document::tokenizer::tokenize(source, &document::tokenizer::TokenizeOptions::default());
    let new_parser = if tolerant {
        document::parser::DocumentParser::new_tolerant
    } else {
        document::parser::DocumentParser::new
    };
    let mut parser = new_parser(tokens, source, parse_html, allow_unclosed_document_node);
    let result = parser.parse_document();
    Ok(wire::emit_result(&result, &Utf16Offsets::new(source)))
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

/// The tag `Parser` for `debug_parse_tag`. A `{% liquid %}` callback fails,
/// as the TS script's stub does.
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

    let tokens = tokenize_markup_at(&source[start..end], start);
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

/// Test-only: applies the `js.rs` helper `op` to each string of the JSON
/// array `input_json` and returns the results as a JSON array, for
/// `scripts/rust-parity-js.ts`. The class ops `is_whitespace`, `is_word`,
/// `is_digit`, `is_ascii_alpha` and `is_line_terminator` take one-char strings
/// and return bools. `to_lower` returns strings. `unicode_version` ignores its
/// input and returns `[char::UNICODE_VERSION]`.
#[wasm_bindgen]
pub fn debug_js(op: &str, input_json: &str) -> Result<String, JsError> {
    if op == "unicode_version" {
        let (major, minor, update) = char::UNICODE_VERSION;
        return Ok(json!([format!("{major}.{minor}.{update}")]).to_string());
    }
    let inputs: Vec<String> = serde_json::from_str(input_json)
        .map_err(|error| JsError::new(&format!("input_json is not a string array: {error}")))?;
    if op == "to_lower" {
        let lowered: Vec<String> = inputs.iter().map(|s| js::js_to_lower(s)).collect();
        return Ok(json!(lowered).to_string());
    }
    let class: fn(char) -> bool = match op {
        "is_whitespace" => js::js_is_whitespace,
        "is_word" => js::js_is_word,
        "is_digit" => js::js_is_digit,
        "is_ascii_alpha" => js::js_is_ascii_alpha,
        "is_line_terminator" => js::js_is_line_terminator,
        _ => return Err(JsError::new(&format!("unknown debug_js op '{op}'"))),
    };
    let results = inputs
        .iter()
        .map(|s| {
            let mut chars = s.chars();
            match (chars.next(), chars.next()) {
                (Some(c), None) => Ok(class(c)),
                _ => Err(JsError::new(&format!("'{op}' needs one char, got {s:?}"))),
            }
        })
        .collect::<Result<Vec<bool>, JsError>>()?;
    Ok(json!(results).to_string())
}
