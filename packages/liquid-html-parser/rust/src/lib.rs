//! Rust/WASM backend for `@shopify/liquid-html-parser`.
//!
//! `rust/register.mjs` instantiates this module and registers `parse` as the
//! parser backend. The `replay_*` exports belong to the marshalling gate and
//! are never called by `parse`. The `debug_*` exports are test-only, for
//! `scripts/rust-parity-tokens.ts`, and are never called by `parse` either.

use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

mod gate;
mod js;
mod offsets;

mod document {
    pub mod tokenizer;
}

mod markup {
    pub mod tokenizer;
}

pub use gate::{replay_emit_json, replay_emit_object, replay_load};

use offsets::Utf16Offsets;

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
