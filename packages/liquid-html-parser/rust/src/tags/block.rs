//! Port of `src/tags/block.ts`.

use crate::errors::ParseError;
use crate::js::{js_is_ascii_alpha, js_is_digit, js_is_word};
use crate::markup::parser::MarkupParser;
use crate::markup::tokenizer::MarkupTokenType;
use crate::tag_definitions::Parser;
use crate::types::NodeTypes;
use crate::value::{JsVal, obj};

/// TS `BLOCK_TYPE_REGEX`, `/^_?[a-zA-Z0-9][\w-]*$/`.
fn is_block_type(value: &str) -> bool {
    let rest = value.strip_prefix('_').unwrap_or(value);
    let mut chars = rest.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    (js_is_ascii_alpha(first) || js_is_digit(first)) && chars.all(|c| js_is_word(c) || c == '-')
}

pub fn parse(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    if markup.is_at_end() {
        return Err(ParseError::error("in 'block' - missing block type"));
    }

    let name = markup.value_expression()?;
    if !name.type_is(NodeTypes::String.as_str()) {
        return Err(ParseError::error(
            "in 'block' - file name must be a string literal",
        ));
    }
    let value = name.string("value");
    if !is_block_type(&value) {
        return Err(ParseError::error(format!(
            "in 'block' - '{value}' is not a valid block type"
        )));
    }

    let mut args = Vec::new();
    if markup.consume_optional(MarkupTokenType::Comma).is_some() && !markup.is_at_end() {
        args = markup.block_named_arguments()?;
    }

    if !markup.is_at_end() {
        let token = markup.peek();
        return Err(ParseError::error(format!(
            "Unexpected token in 'block' tag: {}",
            token.value
        )));
    }

    let start = name.start();
    Ok(obj! {
        "type" => JsVal::str(NodeTypes::BlockMarkup.as_str()),
        "name" => name,
        "args" => JsVal::array(args),
        "position" => JsVal::position(start, markup.peek().start),
        "source" => JsVal::Null,
    })
}
