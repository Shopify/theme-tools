//! Port of `src/tags/case.ts`. The lax branches of `whenBranchParse` are not
//! ported.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::markup::tokenizer::MarkupTokenType;
use crate::tag_definitions::Parser;
use crate::types::NodeTypes;
use crate::value::JsVal;

pub fn parse(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    markup.value_expression()
}

/// Branch parse function for `{% when val1, val2 or val3 %}`.
#[allow(dead_code)] // 5c: src/document/liquid-blocks.ts:359
pub fn when_branch_parse(_name: &str, markup: &mut MarkupParser<'_>) -> Result<JsVal, ParseError> {
    let mut values = vec![markup.value_expression()?];

    loop {
        if markup.consume_optional(MarkupTokenType::Comma).is_some() {
            values.push(markup.value_expression()?);
            continue;
        }

        let token = markup.peek();
        if token.kind == MarkupTokenType::Logical && token.value == "or" {
            markup.consume(MarkupTokenType::Logical)?;
            values.push(markup.value_expression()?);
            continue;
        }

        break;
    }

    let trailing_colon = markup.peek();
    let last_value = &values[values.len() - 1];
    if trailing_colon.kind == MarkupTokenType::Colon
        && markup.look(MarkupTokenType::EndOfString, 1)
        && last_value.type_is(NodeTypes::String.as_str())
        && last_value.end() == trailing_colon.start
    {
        markup.consume(MarkupTokenType::Colon)?;
    }

    Ok(JsVal::array(values))
}
