//! Port of `src/tags/paginate.ts`.

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
    let collection = markup.value_expression()?;

    if !markup.id("by") {
        return Err(ParseError::error("Expected 'by' in paginate tag"));
    }

    let page_size = markup.value_expression()?;

    let mut args = Vec::new();
    if markup.consume_optional(MarkupTokenType::Comma).is_some() {
        args.extend(markup.named_arguments()?);
    } else if markup.is_tolerant() && markup.peek().kind == MarkupTokenType::Id {
        // Tolerant: paginate accepts whitespace-separated named attrs with no
        // leading comma (`... by N window_size: 50`).
        args.extend(markup.named_arguments()?);
    }

    let start = collection.start();
    Ok(obj! {
        "type" => JsVal::node_type(NodeTypes::PaginateMarkup),
        "collection" => collection,
        "pageSize" => page_size,
        "args" => JsVal::array(args),
        "position" => JsVal::position(start, markup.peek().start),
        "source" => JsVal::Null,
    })
}
