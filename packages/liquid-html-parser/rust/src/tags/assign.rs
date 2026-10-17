//! Port of `src/tags/assign.ts`. The lax name branch is not ported.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::markup::tokenizer::MarkupTokenType;
use crate::tag_definitions::Parser;
use crate::types::NodeTypes;
use crate::value::{JsVal, obj};

pub fn parse(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    let start = markup.peek().start;
    let name = markup.consume(MarkupTokenType::Id)?.value;
    let eq_token = markup.consume(MarkupTokenType::Equality)?;
    if eq_token.value != "=" {
        return Err(ParseError::error("Expected '=' in assign tag"));
    }
    let value = markup.liquid_variable()?;
    Ok(obj! {
        "type" => JsVal::node_type(NodeTypes::AssignMarkup),
        "name" => JsVal::str(name),
        "value" => value,
        "position" => JsVal::position(start, markup.peek().start),
        "source" => JsVal::Null,
    })
}
