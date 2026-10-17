//! Port of `src/document/liquid-tags.ts`.

use crate::document::factories::{
    LiquidTagEnvelope, envelope_from_tokens, make_liquid_tag_base_case,
    make_liquid_tag_base_case_bare, make_liquid_tag_named,
};
use crate::document::liquid_blocks::parse_block_tag;
use crate::document::liquid_raw::parse_raw_tag;
use crate::document::parser::DocumentParser;
use crate::document::tokenizer::{Token, TokenType};
use crate::environment::{TagLookup, tag_for_name};
use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::markup::tokenizer::tokenize_markup_at;
use crate::tag_definitions::{TagDefinition, TagParse};
use crate::value::JsVal;

// liquidTag := "{%" tagName markup "%}" (block | raw)?
pub fn parse_liquid_tag(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let open_token = parser.consume(TokenType::LiquidTagOpen)?;
    parser.accept(TokenType::Text);
    let close_token = parser.consume(TokenType::LiquidTagClose)?;

    let envelope = envelope_from_tokens(open_token, close_token, parser.source);

    if let Some(comment_name) = envelope.tag_name.strip_prefix('#') {
        let comment_markup = format!("{comment_name}{}", envelope.markup_string);
        let comment_markup_offset = envelope.markup_end - comment_markup.len();
        let comment_envelope = LiquidTagEnvelope {
            tag_name: "#".to_string(),
            markup_string: comment_markup,
            markup_offset: comment_markup_offset,
            ..envelope
        };
        return Ok(make_liquid_tag_base_case_bare(&comment_envelope, None));
    }

    if let Some(inner_name) = envelope.tag_name.strip_prefix("end") {
        // TS `isStructuralEndTag(innerName, innerDef)`, which is `innerDef !== undefined`.
        if !matches!(tag_for_name(inner_name), TagLookup::Missing) {
            return Err(ParseError::parsing(
                format!(
                    "Attempting to close LiquidTag '{inner_name}' before it was opened without a matching '{inner_name}'"
                ),
                open_token.start,
                close_token.end,
            ));
        }
    }

    let definition = match tag_for_name(&envelope.tag_name) {
        TagLookup::Missing => return Ok(make_liquid_tag_base_case_bare(&envelope, None)),
        // TS assertNever(def), utils.ts:4: no Object.prototype value has a type
        TagLookup::ProtoKey => return Err(ParseError::error("Unexpected object: undefined")),
        TagLookup::Builtin(definition) => definition,
    };

    match definition {
        TagDefinition::Tag { parse } => {
            Ok(parse_standalone_tag(parser, *parse, &envelope, close_token))
        }
        TagDefinition::Block { parse, branches } => {
            parse_block_tag(parser, *parse, branches, &envelope, close_token)
        }
        TagDefinition::Raw {
            parse_liquid_in_body,
            ..
        } => parse_raw_tag(parser, *parse_liquid_in_body, &envelope, close_token),
    }
}

// standaloneTag := "{%" tagName markup "%}"
fn parse_standalone_tag(
    parser: &mut DocumentParser<'_>,
    parse: TagParse,
    envelope: &LiquidTagEnvelope,
    close_token: Token,
) -> JsVal {
    let source = parser.source;
    let markup_string_start = close_token.start - envelope.markup_string.len();
    let markup_string_end = markup_string_start + envelope.markup_string.len();
    let tokens = tokenize_markup_at(&envelope.markup_string, markup_string_start);
    let mut markup_parser = MarkupParser::new(
        tokens,
        source,
        Some(markup_string_start),
        Some(markup_string_end),
    );
    if parser.is_tolerant() {
        markup_parser.enable_tolerant();
    }
    match parse(&envelope.tag_name, &mut markup_parser, parser) {
        Ok(_) if !markup_parser.is_at_end() => make_liquid_tag_base_case(
            envelope,
            JsVal::Undefined,
            JsVal::Undefined,
            None,
            Some("unexpected tokens after markup".to_string()),
            false,
        ),
        Ok(markup) => {
            make_liquid_tag_named(envelope, markup, JsVal::Undefined, JsVal::Undefined, None)
        }
        Err(e) => make_liquid_tag_base_case_bare(envelope, Some(e.message().to_string())),
    }
}
