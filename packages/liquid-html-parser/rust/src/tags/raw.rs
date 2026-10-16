//! Port of `src/tags/raw.ts`.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::tag_definitions::Parser;
use crate::value::JsVal;

/// Returns `undefined`, as the TS `void` function does.
pub fn parse_no_markup(
    name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    if !markup.is_at_end() {
        return Err(ParseError::error(format!(
            "'{name}' tag does not accept markup"
        )));
    }
    Ok(JsVal::Undefined)
}
