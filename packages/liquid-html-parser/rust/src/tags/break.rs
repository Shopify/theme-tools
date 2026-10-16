//! Port of `src/tags/break.ts`.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::tag_definitions::Parser;
use crate::value::JsVal;

pub fn parse(
    name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    if !markup.is_at_end() {
        return Err(ParseError::error(format!(
            "'{name}' tag does not accept markup"
        )));
    }
    Ok(JsVal::str(""))
}
