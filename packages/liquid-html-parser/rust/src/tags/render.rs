//! Port of `src/tags/render.ts`, for `render` and `include`.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::markup::tokenizer::MarkupTokenType;
use crate::tag_definitions::Parser;
use crate::types::NodeTypes;
use crate::value::{JsVal, obj};

/// A render/include named-argument key at the cursor: a bare `Id Colon`.
fn looks_like_named_argument(markup: &MarkupParser<'_>) -> bool {
    markup.look(MarkupTokenType::Id, 0) && markup.look(MarkupTokenType::Colon, 1)
}

fn parse_render_markup(
    markup: &mut MarkupParser<'_>,
    allow_any_template_name: bool,
) -> Result<JsVal, ParseError> {
    let snippet = markup.value_expression()?;
    if !allow_any_template_name
        && !snippet.type_is(NodeTypes::String.as_str())
        && !snippet.type_is(NodeTypes::VariableLookup.as_str())
    {
        return Err(ParseError::error(format!(
            "Expected string or variable lookup for snippet, got {}",
            snippet.type_name()
        )));
    }

    let mut variable = JsVal::Null;
    let mut alias = JsVal::Null;

    let kw_start = markup.peek().start;
    let kind = if markup.id("for") {
        Some("for")
    } else if markup.id("with") {
        Some("with")
    } else {
        None
    };

    if let Some(kind) = kind {
        let name = markup.value_expression()?;
        let end = name.end();
        variable = obj! {
            "type" => JsVal::node_type(NodeTypes::RenderVariableExpression),
            "kind" => JsVal::str(kind),
            "name" => name,
            "position" => JsVal::position(kw_start, end),
            "source" => JsVal::Null,
        };
    }

    // Handle 'as alias', after 'with expr' / 'for expr' or standalone
    let as_start = markup.peek().start;
    if markup.id("as") {
        let alias_token = markup.consume(MarkupTokenType::Id)?;
        alias = obj! {
            "type" => JsVal::node_type(NodeTypes::RenderAliasExpression),
            "value" => JsVal::str(alias_token.value),
            "position" => JsVal::position(as_start, alias_token.end),
            "source" => JsVal::Null,
        };
    }

    // Commas between named args are optional in Ruby `render`/`include`.
    let mut args = Vec::new();
    markup.consume_optional(MarkupTokenType::Comma);
    while looks_like_named_argument(markup) {
        args.push(markup.named_argument()?);
        markup.consume_optional(MarkupTokenType::Comma);
    }

    let end = markup.peek().start;
    let start = snippet.start();
    Ok(obj! {
        "type" => JsVal::node_type(NodeTypes::RenderMarkup),
        "snippet" => snippet,
        "variable" => variable,
        "alias" => alias,
        "args" => JsVal::array(args),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    })
}

pub fn parse_render(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    parse_render_markup(markup, false)
}

pub fn parse_include(
    _name: &str,
    markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    parse_render_markup(markup, true)
}
