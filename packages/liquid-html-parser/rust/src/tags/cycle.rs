//! Port of `src/tags/cycle.ts`. The lax trailing-comma branch is not ported.

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
    let first = markup.value_expression()?;
    let mut group_name = JsVal::Null;
    let mut args = Vec::new();

    if markup.consume_optional(MarkupTokenType::Colon).is_some() {
        group_name = first.clone();
        args.push(markup.value_expression()?);
    } else {
        args.push(first.clone());
    }

    while markup.consume_optional(MarkupTokenType::Comma).is_some() {
        args.push(markup.value_expression()?);
    }

    let start = first.start();
    Ok(obj! {
        "type" => JsVal::str(NodeTypes::CycleMarkup.as_str()),
        "groupName" => group_name,
        "args" => JsVal::array(args),
        "position" => JsVal::position(start, markup.peek().start),
        "source" => JsVal::Null,
    })
}
