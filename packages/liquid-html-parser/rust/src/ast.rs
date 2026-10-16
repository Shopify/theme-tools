//! Port of the parts of `src/ast.ts` the markup parser uses. 5c adds what the
//! document parser uses.

use crate::value::JsVal;

/// TS `LiquidLiteralValues`, in its key order.
pub const LIQUID_LITERAL_VALUES: [(&str, JsVal); 6] = [
    ("nil", JsVal::Null),
    ("null", JsVal::Null),
    ("true", JsVal::Bool(true)),
    ("false", JsVal::Bool(false)),
    ("blank", JsVal::Str(String::new())),
    ("empty", JsVal::Str(String::new())),
];

/// TS `LiquidStatement`.
pub type LiquidStatement = JsVal;
