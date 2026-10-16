//! Port of `src/tags/echo.ts`.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::tag_definitions::Parser;
use crate::value::JsVal;

pub fn parse(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    markup.liquid_variable()
}
