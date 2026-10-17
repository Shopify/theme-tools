//! Port of `src/tags/section.ts`.

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
    let name = markup.value_expression()?;
    if !name.type_is(NodeTypes::String.as_str()) {
        return Err(ParseError::error(format!(
            "Expected string for section name, got {}",
            name.type_name()
        )));
    }

    let mut args = Vec::new();
    if markup.consume_optional(MarkupTokenType::Comma).is_some() {
        args.extend(markup.block_named_arguments()?);
    }

    let start = name.start();
    Ok(obj! {
        "type" => JsVal::node_type(NodeTypes::SectionMarkup),
        "name" => name,
        "args" => JsVal::array(args),
        "position" => JsVal::position(start, markup.peek().start),
        "source" => JsVal::Null,
    })
}
