//! Port of `src/document/node-dispatch.ts`.

use crate::document::factories::{make_text_node, make_yaml_frontmatter};
use crate::document::html::{
    parse_html_comment, parse_html_dangling_marker_close, parse_html_doctype, parse_html_element,
    parse_orphaned_html_close_tag,
};
use crate::document::liquid_tags::parse_liquid_tag;
use crate::document::liquid_variable_output::parse_liquid_variable_output;
use crate::document::parser::DocumentParser;
use crate::document::tokenizer::TokenType;
use crate::errors::ParseError;
use crate::value::JsVal;

// node := text | yamlFrontmatter | liquidVariableOutput | liquidTag | htmlElement | htmlComment | htmlDoctype
pub fn parse_node(p: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let token = p.peek();

    match token.kind {
        TokenType::Text => {
            p.advance();
            Ok(make_text_node(
                &p.source[token.start..token.end],
                token.start,
                token.end,
            ))
        }

        TokenType::YamlFrontmatter => Ok(parse_yaml_frontmatter(p)),

        TokenType::EndOfInput => Err(ParseError::parsing(
            "Unexpected end of input in parseNode",
            token.start,
            token.end,
        )),

        TokenType::LiquidVariableOutputOpen => parse_liquid_variable_output(p),

        TokenType::LiquidTagOpen => parse_liquid_tag(p),

        TokenType::LiquidTagClose | TokenType::LiquidVariableOutputClose => Ok(advance_as_text(p)),

        TokenType::HtmlTagOpen if p.parse_html => parse_html_element(p),

        TokenType::HtmlCloseTagOpen if p.parse_html && p.allow_unclosed_html => {
            parse_html_dangling_marker_close(p)
        }
        TokenType::HtmlCloseTagOpen if p.parse_html => parse_orphaned_html_close_tag(p),

        TokenType::HtmlCommentOpen if p.parse_html => parse_html_comment(p),

        TokenType::HtmlDoctypeOpen if p.parse_html => parse_html_doctype(p),

        TokenType::HtmlTagOpen
        | TokenType::HtmlCloseTagOpen
        | TokenType::HtmlCommentOpen
        | TokenType::HtmlDoctypeOpen
        | TokenType::HtmlTagClose
        | TokenType::HtmlSelfClose
        | TokenType::HtmlCommentClose
        | TokenType::HtmlEquals
        | TokenType::HtmlQuoteOpen
        | TokenType::HtmlQuoteClose => Ok(advance_as_text(p)),
    }
}

// yamlFrontmatter := "---" text "---"
pub fn parse_yaml_frontmatter(p: &mut DocumentParser<'_>) -> JsVal {
    let token = p.advance();
    let raw = &p.source[token.start..token.end];
    let first_newline = raw.find('\n');
    let last_dashes = raw.rfind("---");
    let body = match (first_newline, last_dashes) {
        (Some(newline), Some(dashes)) if dashes > newline => &raw[newline + 1..dashes],
        _ => "",
    };

    make_yaml_frontmatter(body, token.start, token.end)
}

pub fn advance_as_text(p: &mut DocumentParser<'_>) -> JsVal {
    let token = p.advance();
    make_text_node(&p.source[token.start..token.end], token.start, token.end)
}
