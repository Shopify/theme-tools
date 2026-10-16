//! Port of `src/tags/if.ts`, for `if` and `unless`.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::tag_definitions::Parser;
use crate::value::JsVal;

pub fn parse_conditional_expression(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    markup.conditional_expression()
}

/// Branch parse function for `{% elsif condition %}`.
pub fn elsif_branch_parse(_name: &str, markup: &mut MarkupParser<'_>) -> Result<JsVal, ParseError> {
    markup.conditional_expression()
}
