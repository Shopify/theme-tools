//! Marshalling gate: replays a TS-produced AST so only the transfer into JS is timed.
//!
//! `replay_load` takes an AST already in the backend wire format and keeps it.
//! The two emit functions hand that same value to JS by the two candidate
//! boundary strategies:
//! - `replay_emit_json`: a JSON string, for `JSON.parse` on the JS side;
//! - `replay_emit_object`: JS objects built by `serde_wasm_bindgen`.

use std::cell::RefCell;

use serde::Serialize;
use serde_json::Value;
use wasm_bindgen::prelude::*;

thread_local! {
    static LOADED: RefCell<Option<Value>> = const { RefCell::new(None) };
}

/// Parses and keeps a wire-format AST. Called outside the timed region.
#[wasm_bindgen]
pub fn replay_load(json: &str) -> Result<(), JsError> {
    let value: Value = serde_json::from_str(json)?;
    LOADED.with(|loaded| *loaded.borrow_mut() = Some(value));
    Ok(())
}

/// Strategy (a): the loaded AST as a JSON string.
#[wasm_bindgen]
pub fn replay_emit_json() -> Result<String, JsError> {
    with_loaded(|value| serde_json::to_string(value).map_err(JsError::from))
}

/// Strategy (b): the loaded AST as JS values.
///
/// The JSON-compatible serializer emits plain objects rather than `Map`s and
/// `null` rather than `undefined`, matching what `JSON.parse` gives.
#[wasm_bindgen]
pub fn replay_emit_object() -> Result<JsValue, JsError> {
    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    with_loaded(|value| value.serialize(&serializer).map_err(JsError::from))
}

fn with_loaded<T>(emit: impl FnOnce(&Value) -> Result<T, JsError>) -> Result<T, JsError> {
    LOADED.with(|loaded| match loaded.borrow().as_ref() {
        Some(value) => emit(value),
        None => Err(JsError::new("replay_emit called before replay_load")),
    })
}
