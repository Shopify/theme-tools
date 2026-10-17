//! Port of `src/tags/content-for.ts`.

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
    let content_for_type = markup.value_expression()?;
    if !content_for_type.type_is(NodeTypes::String.as_str()) {
        return Err(ParseError::error(format!(
            "Expected string for content_for type, got {}",
            content_for_type.type_name()
        )));
    }

    let mut args = Vec::new();
    markup.consume_optional(MarkupTokenType::Comma);
    while markup.look(MarkupTokenType::Id, 0) {
        let Ok(arg) = markup.named_argument() else {
            break;
        };
        args.push(arg);
        markup.consume_optional(MarkupTokenType::Comma);
    }

    let start = content_for_type.start();
    Ok(obj! {
        "type" => JsVal::node_type(NodeTypes::ContentForMarkup),
        "contentForType" => content_for_type,
        "args" => JsVal::array(args),
        "position" => JsVal::position(start, markup.peek().start),
        "source" => JsVal::Null,
    })
}
