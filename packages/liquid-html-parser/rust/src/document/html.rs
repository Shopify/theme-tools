//! Port of `src/document/html.ts`.
//!
//! `peekHtmlCloseTagMatches` is not ported: no TS code calls it.

use crate::ast::RawMarkupKinds;
use crate::document::factories::{
    make_attr_double_quoted, make_attr_empty, make_attr_single_quoted, make_attr_unquoted,
    make_html_comment, make_html_dangling_marker_close, make_html_doctype, make_html_element,
    make_html_raw_node, make_html_self_closing_element, make_html_void_element, make_raw_markup,
    make_text_node,
};
use crate::document::liquid_blocks::{is_block_terminator, peek_tag_name};
use crate::document::liquid_raw::{has_liquid_open, parse_liquid_in_range};
use crate::document::liquid_tags::parse_liquid_tag;
use crate::document::liquid_variable_output::parse_liquid_variable_output;
use crate::document::node_dispatch::parse_node;
use crate::document::parser::DocumentParser;
use crate::document::tokenizer::{Token, TokenType};
use crate::document::tree_builder::{ChildFilterMode, compound_names_match, filter_children};
use crate::errors::ParseError;
use crate::grammar::{BLOCKS, HTML_RAW_TAGS, VOID_ELEMENTS};
use crate::js::{
    js_ascii_ci_starts_with, js_is_line_terminator, js_is_whitespace, js_to_lower, js_trim,
    js_trim_start,
};
use crate::types::NodeTypes;
use crate::value::JsVal;

const BRANCH_KEYWORDS: [&str; 3] = ["else", "elsif", "when"];

/// TS `plainName || 'compound'`.
fn name_or_compound(plain_name: &Option<String>) -> &str {
    plain_name
        .as_deref()
        .filter(|name| !name.is_empty())
        .unwrap_or("compound")
}

/// JS `/^\s*$/.test(s)`, at `html.ts:140`, `:274` and `:300`, per round 6 D8.
/// No `u` flag, and every `\s` char is BMP, so a char-wise
/// `js_is_whitespace` test matches the UTF-16 unit-wise regex.
fn is_blank(s: &str) -> bool {
    s.chars().all(js_is_whitespace)
}

/// Skips the whitespace-only Text tokens before a close tag's `>`.
fn skip_blank_text(parser: &mut DocumentParser<'_>) {
    while parser.check(TokenType::Text) {
        let token = parser.peek();
        if !is_blank(&parser.source[token.start..token.end]) {
            break;
        }
        parser.advance();
    }
}

/// The end of the token before the cursor.
fn previous_token_end(parser: &DocumentParser<'_>) -> usize {
    parser.token_at(parser.get_position() - 1).end
}

// htmlElement := "<" compoundName attributes ("/" | ">") children? "</" compoundName ">"
pub fn parse_html_element(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let source = parser.source;
    let open_tag_start = parser.peek().start;
    parser.consume(TokenType::HtmlTagOpen)?;

    let name = parse_compound_name(parser)?;
    let attributes = parse_attributes(parser)?;

    if parser.accept(TokenType::HtmlSelfClose).is_some() {
        let open_tag_end = previous_token_end(parser);
        let block_start_position = JsVal::position(open_tag_start, open_tag_end);
        return Ok(make_html_self_closing_element(
            name,
            attributes,
            block_start_position,
        ));
    }

    parser.consume(TokenType::HtmlTagClose)?;
    let open_tag_end = previous_token_end(parser);
    let block_start_position = JsVal::position(open_tag_start, open_tag_end);

    let plain_name = extract_plain_name(&name);
    if let Some(plain) = plain_name
        .as_deref()
        .filter(|plain| VOID_ELEMENTS.contains(&js_to_lower(plain).as_str()))
    {
        return Ok(make_html_void_element(
            plain,
            attributes,
            block_start_position,
        ));
    }

    if let Some(plain) = plain_name
        .as_deref()
        .filter(|plain| HTML_RAW_TAGS.contains(&js_to_lower(plain).as_str()))
    {
        return parse_html_raw_body(parser, plain, attributes, block_start_position);
    }

    let mut children: Vec<JsVal> = Vec::new();
    while !parser.is_at_end() {
        if parser.check(TokenType::HtmlCloseTagOpen) {
            break;
        }
        if is_block_terminator(parser) {
            if !parser.allow_unclosed_html {
                let tag_name = peek_tag_name(parser).unwrap_or_default();
                return Err(ParseError::parsing(
                    format!(
                        "Attempting to close LiquidTag '{tag_name}' before HtmlElement '{}' was closed",
                        name_or_compound(&plain_name)
                    ),
                    open_tag_start,
                    open_tag_end,
                ));
            }
            break;
        }
        children.push(parse_node(parser)?);
    }

    if parser.is_at_end() || (parser.allow_unclosed_html && is_block_terminator(parser)) {
        if !parser.allow_unclosed_html {
            return Err(ParseError::parsing(
                format!(
                    "Attempting to end parsing before HtmlElement '{}' was closed",
                    name_or_compound(&plain_name)
                ),
                open_tag_start,
                open_tag_end,
            ));
        }
        let end_pos = children.last().map_or(open_tag_end, JsVal::end);
        let block_end_position = JsVal::position(end_pos, end_pos);
        let merged = filter_children(ChildFilterMode::Syntactic, children, source);
        return Ok(make_html_element(
            name,
            attributes,
            merged,
            block_start_position,
            block_end_position,
        ));
    }

    let close_start = parser.peek().start;
    parser.consume(TokenType::HtmlCloseTagOpen)?;
    let close_name = parse_compound_name(parser)?;

    skip_blank_text(parser);

    parser.consume(TokenType::HtmlTagClose)?;
    let close_end = previous_token_end(parser);

    if !compound_names_match(&name, &close_name, source) {
        let close_plain_name = extract_plain_name(&close_name);
        return Err(ParseError::parsing(
            format!(
                "Attempting to close HtmlElement '{}' before HtmlElement '{}' was closed",
                name_or_compound(&close_plain_name),
                name_or_compound(&plain_name)
            ),
            close_start,
            close_end,
        ));
    }

    let block_end_position = JsVal::position(close_start, close_end);
    let merged = filter_children(ChildFilterMode::Syntactic, children, source);
    Ok(make_html_element(
        name,
        attributes,
        merged,
        block_start_position,
        block_end_position,
    ))
}

// htmlRawBody := (text | liquidVariableOutput | liquidTag)* "</" tagName ">"
pub fn parse_html_raw_body(
    parser: &mut DocumentParser<'_>,
    plain_name: &str,
    attributes: Vec<JsVal>,
    block_start_position: JsVal,
) -> Result<JsVal, ParseError> {
    let source = parser.source;
    let body_start = block_start_position.get("end").offset();

    let Some(close_idx) = scan_for_html_close_tag(parser, plain_name) else {
        return Err(ParseError::parsing(
            format!("Attempting to end parsing before HtmlRawNode '{plain_name}' was closed"),
            block_start_position.get("start").offset(),
            body_start,
        ));
    };

    let body_end = parser.token_at(close_idx).start;
    let body_string = &source[body_start..body_end];

    let body_nodes = parse_liquid_in_range(parser, body_start, body_end)?;

    let kind = raw_markup_kind_for_html_tag(plain_name, &attributes, body_string);
    let body = make_raw_markup(kind, body_string, body_nodes, body_start, body_end);

    // Re-seek to the close tag by its stable source offset: a cached token
    // index can go stale after a reslice, and the live cursor can over-advance.
    parser.seek_to_source_offset(body_end);
    let close_start = parser.peek().start;
    parser.consume(TokenType::HtmlCloseTagOpen)?;
    while parser.check(TokenType::Text) {
        parser.advance();
    }
    let close_end = parser.consume(TokenType::HtmlTagClose)?.end;

    let block_end_position = JsVal::position(close_start, close_end);
    Ok(make_html_raw_node(
        plain_name,
        attributes,
        body,
        block_start_position,
        block_end_position,
    ))
}

// htmlComment := "<!--" text* "-->"
pub fn parse_html_comment(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let source = parser.source;
    let open_token = parser.consume(TokenType::HtmlCommentOpen)?;
    let body_start = open_token.end;

    // Find the closing `-->` by scanning the source rather than walking
    // tokens, because a conditional comment body can hide it from the
    // tokenizer.
    let Some(close_idx) = source[body_start..]
        .find("-->")
        .map(|found| body_start + found)
    else {
        return Err(ParseError::parsing(
            "Attempting to end parsing before HtmlComment '<!--' was closed",
            open_token.start,
            open_token.end,
        ));
    };

    let body_end = close_idx;
    let comment_end = close_idx + 3; // past `-->`
    let body = js_trim(&source[body_start..body_end]);

    parser.seek_to_source_offset(comment_end);

    Ok(make_html_comment(body, open_token.start, comment_end))
}

/// JS `body.match(/^doctype\s+html\s*(.*)/i)`: `None` for no match, else
/// group 1.
fn match_doctype_html(body: &str) -> Option<&str> {
    if !js_ascii_ci_starts_with(body, "doctype") {
        return None;
    }
    let after_doctype = &body["doctype".len()..];
    let after_ws = after_doctype.trim_start_matches(js_is_whitespace);
    if after_ws.len() == after_doctype.len() || !js_ascii_ci_starts_with(after_ws, "html") {
        return None;
    }
    let rest = after_ws["html".len()..].trim_start_matches(js_is_whitespace);
    let group_end = rest.find(js_is_line_terminator).unwrap_or(rest.len());
    Some(&rest[..group_end])
}

// htmlDoctype := "<!" text ">"
pub fn parse_html_doctype(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let source = parser.source;
    let open_token = parser.consume(TokenType::HtmlDoctypeOpen)?;

    while !parser.is_at_end() && !parser.check(TokenType::HtmlTagClose) {
        parser.advance();
    }

    let close_token = parser.consume(TokenType::HtmlTagClose)?;
    let body = js_trim(&source[open_token.end..close_token.start]);

    let legacy_doctype_string = match match_doctype_html(body) {
        Some(group) => Some(group).filter(|group| !group.is_empty()),
        None => Some(body),
    };

    Ok(make_html_doctype(
        legacy_doctype_string,
        open_token.start,
        close_token.end,
    ))
}

/// Always an error: TS returns `never`.
pub fn parse_orphaned_html_close_tag(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let close_start = parser.peek().start;
    parser.consume(TokenType::HtmlCloseTagOpen)?;
    let close_name = parse_compound_name(parser)?;
    skip_blank_text(parser);
    let close_end = parser.consume(TokenType::HtmlTagClose)?.end;
    let plain_close_name = extract_plain_name(&close_name);
    Err(ParseError::parsing(
        format!(
            "Attempting to close HtmlElement '{}' before it was opened",
            name_or_compound(&plain_close_name)
        ),
        close_start,
        close_end,
    ))
}

pub fn parse_html_dangling_marker_close(
    parser: &mut DocumentParser<'_>,
) -> Result<JsVal, ParseError> {
    let start = parser.peek().start;
    parser.consume(TokenType::HtmlCloseTagOpen)?;
    let name = parse_compound_name(parser)?;
    skip_blank_text(parser);
    parser.consume(TokenType::HtmlTagClose)?;
    let end = previous_token_end(parser);
    Ok(make_html_dangling_marker_close(name, start, end))
}

/// A Liquid tag between attributes, parsed in attribute context. TS restores
/// the saved flag only on success.
fn parse_attribute_liquid_tag(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let saved = parser.in_attribute_context;
    parser.in_attribute_context = true;
    let tag = parse_liquid_tag(parser)?;
    parser.in_attribute_context = saved;
    Ok(tag)
}

/// Parse attributes until a block terminator (end tag, branch keyword) is
/// encountered. Used inside Liquid tag branches that appear in HTML attribute
/// context.
pub fn parse_branch_attributes_impl(
    parser: &mut DocumentParser<'_>,
) -> Result<Vec<JsVal>, ParseError> {
    let mut attrs = Vec::new();

    while !parser.is_at_end() {
        skip_space(parser);
        if parser.is_at_end() {
            break;
        }
        if parser.check(TokenType::HtmlTagClose) || parser.check(TokenType::HtmlSelfClose) {
            break;
        }
        if is_block_terminator(parser) {
            break;
        }

        if parser.check(TokenType::LiquidTagOpen) {
            attrs.push(parse_attribute_liquid_tag(parser)?);
            continue;
        }

        if parser.check(TokenType::LiquidVariableOutputOpen) {
            attrs.push(parse_liquid_variable_output(parser)?);
            continue;
        }

        let attr_start = parser.peek().start;
        let name = parse_compound_name(parser)?;
        if name.is_empty() {
            parser.advance();
            continue;
        }
        attrs.push(parse_attribute_after_name(parser, name, attr_start)?);
    }

    Ok(attrs)
}

fn has_segment_of_type(segments: &[JsVal], kind: NodeTypes) -> bool {
    segments
        .iter()
        .any(|segment| segment.type_is(kind.as_str()))
}

// compoundName := (text | liquidVariableOutput | liquidTag)+
pub fn parse_compound_name(parser: &mut DocumentParser<'_>) -> Result<Vec<JsVal>, ParseError> {
    let mut segments = Vec::new();

    while !parser.is_at_end() {
        if parser.check(TokenType::LiquidVariableOutputOpen) {
            segments.push(parse_liquid_variable_output(parser)?);
            continue;
        }

        // Consume `{% ... %}` tags as part of the compound name, but not once
        // the name holds a `{{ drop }}`, and not when the tag opens the
        // attribute list.
        if !parser.in_attribute_context
            && parser.check(TokenType::LiquidTagOpen)
            && !has_segment_of_type(&segments, NodeTypes::LiquidVariableOutput)
            && !liquid_tag_starts_attribute_list(parser, &segments)
        {
            segments.push(parse_liquid_tag(parser)?);
            continue;
        }

        if let Some(segment) = consume_text_segment(parser) {
            segments.push(segment);
            continue;
        }

        break;
    }

    Ok(segments)
}

// attributes := (attribute | liquidVariableOutput | liquidTag)*
pub fn parse_attributes(parser: &mut DocumentParser<'_>) -> Result<Vec<JsVal>, ParseError> {
    // Mark attribute context so a Liquid tag glued to an attribute name is a
    // separate attribute-position tag, not part of the name.
    let saved_attr_context = parser.in_attribute_context;
    parser.in_attribute_context = true;
    // TS `try { ... } finally { restore }`
    let result = parse_attribute_list(parser);
    parser.in_attribute_context = saved_attr_context;
    result
}

fn parse_attribute_list(parser: &mut DocumentParser<'_>) -> Result<Vec<JsVal>, ParseError> {
    let mut attrs = Vec::new();

    while !parser.is_at_end() {
        skip_space(parser);
        if parser.is_at_end() {
            break;
        }
        if parser.check(TokenType::HtmlTagClose) || parser.check(TokenType::HtmlSelfClose) {
            break;
        }

        // Liquid tag between attributes
        if parser.check(TokenType::LiquidTagOpen) {
            attrs.push(parse_attribute_liquid_tag(parser)?);
            continue;
        }

        // Liquid drop between attributes
        if parser.check(TokenType::LiquidVariableOutputOpen) {
            attrs.push(parse_liquid_variable_output(parser)?);
            continue;
        }

        let attr_start = parser.peek().start;
        let name = parse_compound_name(parser)?;
        if name.is_empty() {
            parser.advance();
            continue;
        }
        attrs.push(parse_attribute_after_name(parser, name, attr_start)?);
    }

    Ok(attrs)
}

/// TS `quoteChar === '"' || quoteChar === '“' || quoteChar === '”'`.
fn is_double_quote(quote_char: Option<char>) -> bool {
    matches!(quote_char, Some('"' | '\u{201C}' | '\u{201D}'))
}

// attribute := compoundName (space* "=" space* (quotedAttrValue | unquotedAttrValue))?
fn parse_attribute_after_name(
    parser: &mut DocumentParser<'_>,
    name: Vec<JsVal>,
    attr_start: usize,
) -> Result<JsVal, ParseError> {
    let source = parser.source;
    skip_space(parser);
    if parser.accept(TokenType::HtmlEquals).is_none() {
        let last_segment_end = name[name.len() - 1].end();
        return Ok(make_attr_empty(name, attr_start, last_segment_end));
    }
    skip_space(parser);

    let Some(quote_token) = parser.accept(TokenType::HtmlQuoteOpen) else {
        let (value, value_end) = parse_unquoted_attribute_value(parser)?;
        let attribute_start = value.first().map_or(parser.peek().start, JsVal::start);
        let attribute_position = JsVal::position(attribute_start, value_end);
        return Ok(make_attr_unquoted(
            name,
            value,
            attribute_position,
            attr_start,
            value_end,
        ));
    };

    // TS `source[quoteToken.start]`: every quote is one BMP char.
    let quote_char = source[quote_token.start..].chars().next();
    let value_start = quote_token.end;
    let value = parse_quoted_attribute_value(parser)?;
    let close_quote = parser.consume(TokenType::HtmlQuoteClose)?;
    let attribute_position = JsVal::position(value_start, close_quote.start);
    // Straight and curly double quotes map to a double-quoted attr; straight
    // and curly single quotes map to a single-quoted attr.
    if is_double_quote(quote_char) {
        return Ok(make_attr_double_quoted(
            name,
            value,
            attribute_position,
            attr_start,
            close_quote.end,
        ));
    }
    Ok(make_attr_single_quoted(
        name,
        value,
        attribute_position,
        attr_start,
        close_quote.end,
    ))
}

/// Skip whitespace inside a tag: the tokenizer emits each run as its own Text
/// token.
fn skip_space(parser: &mut DocumentParser<'_>) {
    while parser.check(TokenType::Text) && is_space_token(parser, parser.peek()) {
        parser.advance();
    }
}

/// JS `/^\s/.test(source.slice(token.start, token.start + 1))`. Every
/// whitespace char is one UTF-16 unit, so the first char decides.
fn is_space_token(parser: &DocumentParser<'_>, token: Token) -> bool {
    parser.source[token.start..]
        .chars()
        .next()
        .is_some_and(js_is_whitespace)
}

/// A Liquid tag inside a quoted attribute value, parsed in attribute value
/// context. TS restores the saved flag only on success.
fn parse_attribute_value_liquid_tag(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let saved = parser.in_attribute_value_context;
    parser.in_attribute_value_context = true;
    let tag = parse_liquid_tag(parser)?;
    parser.in_attribute_value_context = saved;
    Ok(tag)
}

// quotedAttrValue := (text | liquidVariableOutput | liquidTag)*
pub fn parse_quoted_attribute_value(
    parser: &mut DocumentParser<'_>,
) -> Result<Vec<JsVal>, ParseError> {
    let mut values = Vec::new();
    let source = parser.source;

    while !parser.is_at_end() && !parser.check(TokenType::HtmlQuoteClose) {
        if parser.check(TokenType::LiquidVariableOutputOpen) {
            values.push(parse_liquid_variable_output(parser)?);
            continue;
        }

        if parser.check(TokenType::LiquidTagOpen) {
            // Branch/end keywords inside quoted attribute values are invalid
            let tag_name = peek_tag_name(parser).unwrap_or_default();
            if BRANCH_KEYWORDS.contains(&tag_name.as_str()) || tag_name.starts_with("end") {
                let token = parser.peek();
                return Err(ParseError::parsing(
                    format!("Unexpected Liquid tag '{tag_name}' inside quoted attribute value"),
                    token.start,
                    token.end,
                ));
            }
            values.push(parse_attribute_value_liquid_tag(parser)?);
            continue;
        }

        if parser.check(TokenType::Text) {
            let token = parser.advance();
            values.push(make_text_node(
                &source[token.start..token.end],
                token.start,
                token.end,
            ));
            continue;
        }

        break;
    }

    Ok(values)
}

// unquotedAttrValue := (text | liquidVariableOutput)+
pub fn parse_unquoted_attribute_value(
    parser: &mut DocumentParser<'_>,
) -> Result<(Vec<JsVal>, usize), ParseError> {
    let mut values = Vec::new();
    let mut end = parser.peek().start;

    while !parser.is_at_end() {
        if parser.check(TokenType::HtmlTagClose) || parser.check(TokenType::HtmlSelfClose) {
            break;
        }

        if let Some(segment) = consume_text_segment(parser) {
            end = segment.end();
            values.push(segment);
            continue;
        }

        if parser.check(TokenType::LiquidVariableOutputOpen) {
            let drop = parse_liquid_variable_output(parser)?;
            end = drop.end();
            values.push(drop);
            continue;
        }

        break;
    }

    Ok((values, end))
}

/// Consume the current Text token as a name or unquoted-value segment, or
/// `None` when it is a whitespace separator.
fn consume_text_segment(parser: &mut DocumentParser<'_>) -> Option<JsVal> {
    if !parser.check(TokenType::Text) {
        return None;
    }
    let token = parser.peek();
    if is_space_token(parser, token) {
        return None;
    }
    parser.advance();
    Some(make_text_node(
        &parser.source[token.start..token.end],
        token.start,
        token.end,
    ))
}

/// Whether a block tag glued to an in-progress literal compound name opens the
/// element's attribute list rather than continuing the name.
fn liquid_tag_starts_attribute_list(parser: &DocumentParser<'_>, segments: &[JsVal]) -> bool {
    if !has_segment_of_type(segments, NodeTypes::TextNode) {
        return false;
    }
    let Some(tag_name) = peek_tag_name(parser) else {
        return false;
    };
    if !BLOCKS.contains(&tag_name.as_str()) {
        return false;
    }
    liquid_tag_body_starts_with_whitespace(parser)
}

/// A `{{-` or `{%-` open delimiter (length 3) left-trims preceding whitespace.
fn is_left_trimming_open(token: Option<Token>) -> bool {
    token.is_some_and(|token| {
        (token.kind == TokenType::LiquidVariableOutputOpen
            || token.kind == TokenType::LiquidTagOpen)
            && token.end - token.start == 3
    })
}

/// Whether the rendered body of the block tag at the cursor begins with
/// whitespace. Markup inside `{% ... %}` is skipped, and a trimming close
/// delimiter strips the body's leading whitespace.
fn liquid_tag_body_starts_with_whitespace(parser: &DocumentParser<'_>) -> bool {
    let source = parser.source;
    let count = parser.token_count();
    let mut in_tag = false;
    let mut trim_next = false;
    for i in parser.get_position()..count {
        let token = parser.token_at(i);
        match token.kind {
            TokenType::LiquidTagOpen => in_tag = true,
            TokenType::LiquidTagClose => {
                in_tag = false;
                trim_next = token.end - token.start == 3; // `-%}` trims following whitespace
            }
            TokenType::Text if !in_tag => {
                let mut text = &source[token.start..token.end];
                if trim_next {
                    text = js_trim_start(text); // `-%}` strips leading whitespace
                }
                trim_next = false;
                if text.is_empty() {
                    continue; // whitespace fully trimmed; keep scanning
                }
                // A whitespace-only run right before a left-trimming `{{-`/`{%-`
                // is stripped from the rendered body.
                // JS `/^\s+$/` at `html.ts:646`. `text` is non-empty here, so `is_blank` matches it.
                if is_blank(text) && is_left_trimming_open(parser.token_at_checked(i + 1)) {
                    continue;
                }
                return text.chars().next().is_some_and(js_is_whitespace);
            }
            // Body begins with a `{{ }}` drop: name continuation, not attributes.
            TokenType::LiquidVariableOutputOpen if !in_tag => return false,
            TokenType::HtmlTagClose | TokenType::HtmlSelfClose | TokenType::EndOfInput
                if !in_tag =>
            {
                return false;
            }
            _ => {}
        }
    }
    false
}

/// TS `extractPlainName`: the value of a name that is one TextNode.
pub fn extract_plain_name(name: &[JsVal]) -> Option<String> {
    if name.len() == 1 && name[0].type_is(NodeTypes::TextNode.as_str()) {
        return Some(name[0].string("value"));
    }
    None
}

/// The tag name of an `HtmlTagOpen` at token `i`, from the Text token after
/// it, or `None` when no Text token follows.
fn open_tag_name_at<'a>(parser: &DocumentParser<'a>, i: usize) -> Option<&'a str> {
    let text = parser.token_at_checked(i + 1)?;
    if text.kind != TokenType::Text {
        return None;
    }
    let trimmed = js_trim_start(&parser.source[text.start..text.end]);
    // TS `trimmed.search(/\s/)`
    Some(match trimmed.find(js_is_whitespace) {
        None => js_trim(trimmed),
        Some(first_ws) => &trimmed[..first_ws],
    })
}

/// The text of the Text-token run after an `HtmlCloseTagOpen` at token `i`,
/// or `None` when no Text token follows.
fn close_tag_text_at<'a>(parser: &DocumentParser<'a>, i: usize) -> Option<&'a str> {
    let count = parser.token_count();
    let mut end = i + 1;
    while end < count && parser.token_at(end).kind == TokenType::Text {
        end += 1;
    }
    if end == i + 1 {
        return None;
    }
    Some(&parser.source[parser.token_at(i).end..parser.token_at(end - 1).end])
}

/// The token index of the close tag matching the raw element `tag_name`,
/// depth-balancing nested same-name elements, or `None` (TS `-1`).
pub fn scan_for_html_close_tag(parser: &DocumentParser<'_>, tag_name: &str) -> Option<usize> {
    let lower_name = js_to_lower(tag_name);
    let mut depth = 0;
    for i in parser.get_position()..parser.token_count() {
        let token = parser.token_at(i);

        if token.kind == TokenType::HtmlTagOpen {
            let opens_same_name =
                open_tag_name_at(parser, i).is_some_and(|name| js_to_lower(name) == lower_name);
            if opens_same_name {
                depth += 1;
            }
            continue;
        }

        if token.kind != TokenType::HtmlCloseTagOpen {
            continue;
        }
        // Compare the whole Text run: `</script marker>` (NBSP) is body text.
        let closes_same_name = close_tag_text_at(parser, i)
            .is_some_and(|text| js_to_lower(js_trim(text)) == lower_name);
        if !closes_same_name {
            continue;
        }
        if depth == 0 {
            return Some(i);
        }
        depth -= 1;
    }
    None
}

pub fn raw_markup_kind_for_html_tag(
    tag_name: &str,
    attributes: &[JsVal],
    body_source: &str,
) -> RawMarkupKinds {
    match js_to_lower(tag_name).as_str() {
        "script" => script_kind_from_attributes(attributes),
        "style" if has_liquid_open(body_source) => RawMarkupKinds::Text,
        "style" => RawMarkupKinds::Css,
        _ => RawMarkupKinds::Text,
    }
}

fn script_kind_from_attributes(attributes: &[JsVal]) -> RawMarkupKinds {
    let Some(type_value) = extract_plain_attribute_value(attributes, "type") else {
        return RawMarkupKinds::Javascript;
    };
    if type_value == "text/html" {
        return RawMarkupKinds::Html;
    }
    if type_value == "text/markdown" {
        return RawMarkupKinds::Markdown;
    }
    if type_value.ends_with("json")
        || type_value.ends_with("importmap")
        || type_value == "speculationrules"
    {
        return RawMarkupKinds::Json;
    }
    RawMarkupKinds::Javascript
}

/// JS `key in node` for an own key.
fn has_key(node: &JsVal, key: &str) -> bool {
    let JsVal::Obj(entries) = node else {
        return false;
    };
    entries.borrow().iter().any(|(name, _)| name == key)
}

fn array_items(value: &JsVal) -> Vec<JsVal> {
    match value {
        JsVal::Arr(items) => items.borrow().clone(),
        _ => Vec::new(),
    }
}

fn extract_plain_attribute_value(attributes: &[JsVal], target_name: &str) -> Option<String> {
    let attr = attributes.iter().find(|attr| {
        has_key(attr, "name")
            && has_key(attr, "value")
            && extract_plain_name(&array_items(&attr.get("name")))
                .is_some_and(|name| js_to_lower(&name) == target_name)
    })?;
    let values = array_items(&attr.get("value"));
    if values.len() == 1 && values[0].type_is(NodeTypes::TextNode.as_str()) {
        return Some(values[0].string("value"));
    }
    None
}
