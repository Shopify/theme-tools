//! Rust/WASM backend for `@shopify/liquid-html-parser`.
//!
//! `rust/register.mjs` instantiates this module and registers `parse` as the
//! parser backend. The parser itself is not ported yet, so `parse` throws.

use wasm_bindgen::prelude::*;

mod gate;

pub use gate::{replay_emit_json, replay_emit_object, replay_load};

/// Backend parse entry point. Throws until the parser port lands.
#[wasm_bindgen]
pub fn parse(
    kind: &str,
    _source: &str,
    _allow_unclosed_document_node: bool,
) -> Result<JsValue, JsError> {
    Err(JsError::new(&format!(
        "Rust parser is not ported yet: cannot parse kind '{kind}'"
    )))
}
