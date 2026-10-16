//! Port of `src/tags/partial.ts`.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::tag_definitions::Parser;
use crate::types::NodeTypes;
use crate::value::JsVal;

pub fn parse(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    let expr = markup.value_expression()?;
    if !expr.type_is(NodeTypes::String.as_str()) {
        return Err(ParseError::error(format!(
            "Expected string for partial name, got {}",
            expr.type_name()
        )));
    }
    Ok(expr)
}
