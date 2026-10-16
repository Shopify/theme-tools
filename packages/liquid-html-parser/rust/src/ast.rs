//! Port of the parts of `src/ast.ts` the parser uses.

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

/// TS `RawMarkupKinds`, the variants the parser emits. `typescript` has no
/// parser site.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RawMarkupKinds {
    Css,
    Html,
    Javascript,
    Json,
    Markdown,
    Text,
}

impl RawMarkupKinds {
    pub fn as_str(self) -> &'static str {
        match self {
            RawMarkupKinds::Css => "css",
            RawMarkupKinds::Html => "html",
            RawMarkupKinds::Javascript => "javascript",
            RawMarkupKinds::Json => "json",
            RawMarkupKinds::Markdown => "markdown",
            RawMarkupKinds::Text => "text",
        }
    }
}
