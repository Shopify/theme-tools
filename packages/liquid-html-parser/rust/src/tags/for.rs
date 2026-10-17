//! Port of `src/tags/for.ts`, for `for` and `tablerow`. The lax named-argument
//! branch is not ported.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::markup::tokenizer::MarkupTokenType;
use crate::tag_definitions::Parser;
use crate::types::NodeTypes;
use crate::value::{JsVal, obj};

pub fn parse_for_markup(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    let name_token = markup.consume(MarkupTokenType::Id)?;
    if !markup.id("in") {
        return Err(ParseError::error("Expected 'in'"));
    }
    let collection = markup.value_expression()?;
    let reversed = markup.id("reversed");

    // Named args in for/tablerow accept optional commas between args
    // (matching Ruby's `p.consume?(:comma)` behavior).
    let mut args = Vec::new();
    while !markup.is_at_end() {
        markup.consume_optional(MarkupTokenType::Comma);
        args.push(markup.named_argument()?);
    }

    Ok(obj! {
        "type" => JsVal::node_type(NodeTypes::ForMarkup),
        "variableName" => JsVal::str(name_token.value),
        "collection" => collection,
        "reversed" => JsVal::Bool(reversed),
        "args" => JsVal::array(args),
        "position" => JsVal::position(name_token.start, markup.peek().start),
        "source" => JsVal::Null,
    })
}
