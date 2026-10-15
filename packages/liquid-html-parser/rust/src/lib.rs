//! Rust/WASM backend for `@shopify/liquid-html-parser`.
//!
//! `rust/register.mjs` instantiates this module and registers `parse` as the
//! parser backend. The `replay_*` exports belong to the marshalling gate and
//! are never called by `parse`.

use wasm_bindgen::prelude::*;

mod gate;

pub use gate::{replay_emit_json, replay_emit_object, replay_load};

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
