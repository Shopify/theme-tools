//! Port of `src/document/liquid-blocks.ts`.

use crate::document::factories::{
    DelimiterWhitespace, LiquidTagEnvelope, delimiter_whitespace, envelope_from_tokens,
    make_liquid_branch_named, make_liquid_branch_unnamed, make_liquid_tag_base_case,
    make_liquid_tag_named,
};
use crate::document::html::parse_branch_attributes_impl;
use crate::document::liquid_tags::parse_liquid_tag;
use crate::document::parser::DocumentParser;
use crate::document::tokenizer::{Token, TokenType};
use crate::document::tree_builder::{ChildFilterMode, filter_children, merge_adjacent_text_nodes};
use crate::environment::{TagLookup, tag_for_name};
use crate::errors::ParseError;
use crate::js::{js_is_whitespace, js_trim, js_trim_start};
use crate::markup::parser::MarkupParser;
use crate::markup::tokenizer::tokenize_markup_at;
use crate::tag_definitions::{BranchName, TagParse};
use crate::tags::case::when_branch_parse;
use crate::tags::r#if::elsif_branch_parse;
use crate::value::JsVal;

const CONDITIONAL_TAGS: [&str; 3] = ["if", "unless", "case"];

/// TS `{ position, whitespace }` from `consumeEndTag`, and the
/// `endPosition`, `endWhitespace` pair the bodies return.
pub struct EndTag {
    pub position: JsVal,
    pub whitespace: DelimiterWhitespace,
}

/// The TS `{ start: '', end: '' }` whitespace of an unclosed body.
const NO_WHITESPACE: DelimiterWhitespace = DelimiterWhitespace { start: "", end: "" };

/// The parsed markup of a block tag: `Some` when TS sets `markupParsed`, and
/// the `reason` otherwise.
pub struct BlockMarkup {
    pub markup: Option<JsVal>,
    pub reason: Option<String>,
}

/// The `try` around `def.parse` in TS `parseBlockTag` and `parseLineBlockTag`.
/// A tokenizer offset of `markup_offset` and no markup bounds, as both build
/// `new MarkupParser(tokens, source)`.
pub fn parse_block_markup(
    parser: &mut DocumentParser<'_>,
    parse: TagParse,
    tag_name: &str,
    markup_string: &str,
    markup_offset: usize,
) -> BlockMarkup {
    let source = parser.source;
    let tokens = tokenize_markup_at(markup_string, markup_offset);
    let mut markup_parser = MarkupParser::new(tokens, source, None, None);
    if parser.is_tolerant() {
        markup_parser.enable_tolerant();
    }
    match parse(tag_name, &mut markup_parser, parser) {
        Ok(_) if !markup_parser.is_at_end() => BlockMarkup {
            markup: None,
            reason: Some("unexpected tokens after markup".to_string()),
        },
        Ok(markup) => BlockMarkup {
            markup: Some(markup),
            reason: None,
        },
        Err(e) => BlockMarkup {
            markup: None,
            reason: Some(e.message().to_string()),
        },
    }
}

/// The `markupParsed ? makeLiquidTagNamed(...) : makeLiquidTagBaseCase(...)`
/// tail of TS `parseBlockTag` and `parseLineBlockTag`.
pub fn make_block_tag(
    envelope: &LiquidTagEnvelope,
    block_markup: BlockMarkup,
    children: Vec<JsVal>,
    end: EndTag,
) -> JsVal {
    match block_markup.markup {
        Some(markup) => make_liquid_tag_named(
            envelope,
            markup,
            JsVal::array(children),
            end.position,
            Some(end.whitespace),
        ),
        None => make_liquid_tag_base_case(
            envelope,
            JsVal::array(children),
            end.position,
            Some(end.whitespace),
            block_markup.reason,
            false,
        ),
    }
}

// blockTag := "{%" tagName markup "%}" branchedBody | blockBody "{%" "end" tagName "%}"
pub fn parse_block_tag(
    parser: &mut DocumentParser<'_>,
    parse: TagParse,
    branches: &[BranchName],
    envelope: &LiquidTagEnvelope,
    close_token: Token,
) -> Result<JsVal, ParseError> {
    let markup_string_start = close_token.start - envelope.markup_string.len();
    let block_markup = parse_block_markup(
        parser,
        parse,
        &envelope.tag_name,
        &envelope.markup_string,
        markup_string_start,
    );

    let saved_allow_unclosed = parser.allow_unclosed_html;
    parser.allow_unclosed_html = CONDITIONAL_TAGS.contains(&envelope.tag_name.as_str());

    // TS `try { ... } finally { restore }`
    let result = parse_block_tag_body(parser, envelope, branches)
        .map(|(children, end)| make_block_tag(envelope, block_markup, children, end));
    parser.allow_unclosed_html = saved_allow_unclosed;
    result
}

fn parse_block_tag_body(
    parser: &mut DocumentParser<'_>,
    envelope: &LiquidTagEnvelope,
    branches: &[BranchName],
) -> Result<(Vec<JsVal>, EndTag), ParseError> {
    if branches.is_empty() {
        return parse_block_body(parser, envelope);
    }
    parse_branched_body(parser, envelope, branches)
}

fn unclosed_liquid_tag_error(envelope: &LiquidTagEnvelope) -> ParseError {
    ParseError::parsing(
        format!(
            "Attempting to end parsing before LiquidTag '{}' was closed",
            envelope.tag_name
        ),
        envelope.block_start_position.get("start").offset(),
        envelope.block_start_position.get("end").offset(),
    )
}

fn close_before_parent_error(inner_name: &str, envelope: &LiquidTagEnvelope) -> ParseError {
    ParseError::parsing(
        format!(
            "Attempting to close LiquidTag '{inner_name}' before LiquidTag '{}' was closed",
            envelope.tag_name
        ),
        envelope.block_start_position.get("start").offset(),
        envelope.block_start_position.get("end").offset(),
    )
}

// blockBody := node* "{%" "end" tagName "%}"
pub fn parse_block_body(
    parser: &mut DocumentParser<'_>,
    envelope: &LiquidTagEnvelope,
) -> Result<(Vec<JsVal>, EndTag), ParseError> {
    let parent_name = envelope.tag_name.as_str();
    let end_name = format!("end{parent_name}");
    let mut children: Vec<JsVal> = Vec::new();

    while !parser.is_at_end() {
        if parser.check(TokenType::LiquidTagOpen) {
            let tag_name = peek_tag_name(parser);
            if tag_name.as_deref() == Some(end_name.as_str()) {
                let end = consume_end_tag(parser)?;
                let merged = filter_children(ChildFilterMode::Syntactic, children, parser.source);
                return Ok((merged, end));
            }

            if let Some(inner_name) = tag_name
                .as_deref()
                .and_then(|name| name.strip_prefix("end"))
            {
                // TS `isStructuralEndTag(innerName, ...)`, which is `def !== undefined`.
                if !matches!(tag_for_name(inner_name), TagLookup::Missing) {
                    return Err(close_before_parent_error(inner_name, envelope));
                }
            }

            if let Some(branch) = tag_name
                .as_deref()
                .filter(|name| matches!(*name, "else" | "elsif" | "when"))
            {
                return Err(ParseError::parsing(
                    format!(
                        "Attempting to open LiquidBranch '{branch}' before LiquidTag '{parent_name}' was closed"
                    ),
                    envelope.block_start_position.get("start").offset(),
                    envelope.block_start_position.get("end").offset(),
                ));
            }
        }
        let progress_start = parser.get_position();
        if parser.in_attribute_context && !parser.in_attribute_value_context {
            children.extend(parse_branch_attributes_impl(parser)?);
        } else {
            children.push(parser.parse_node()?);
        }
        if parser.get_position() == progress_start {
            if !parser.allow_unclosed_document_node {
                return Err(unexpected_block_tag_error(parser, parent_name));
            }
            // Tolerant mode: consume the stalled orphan tag as a degraded node
            // so the loop can still reach the real terminator.
            if parser.check(TokenType::LiquidTagOpen) {
                children.push(parse_liquid_tag(parser)?);
                continue;
            }
            break;
        }
    }

    let merged = filter_children(ChildFilterMode::Syntactic, children, parser.source);
    let end_pos = parser.peek().start;
    if parser.allow_unclosed_document_node {
        let end = EndTag {
            position: JsVal::position(end_pos, end_pos),
            whitespace: NO_WHITESPACE,
        };
        return Ok((merged, end));
    }

    Err(unclosed_liquid_tag_error(envelope))
}

// branchedBody := branch+ "{%" "end" tagName "%}"
pub fn parse_branched_body(
    parser: &mut DocumentParser<'_>,
    envelope: &LiquidTagEnvelope,
    definition_branches: &[BranchName],
) -> Result<(Vec<JsVal>, EndTag), ParseError> {
    let end_name = format!("end{}", envelope.tag_name);
    let body_start = envelope.block_start_position.get("end").offset();
    let mut branches: Vec<JsVal> = Vec::new();
    let mut current_branch = make_liquid_branch_unnamed(body_start);
    let mut current_children: Vec<JsVal> = Vec::new();
    let child_filter_mode = if parser.in_attribute_value_context {
        ChildFilterMode::Preserve
    } else {
        ChildFilterMode::Syntactic
    };

    while !parser.is_at_end() {
        if parser.check(TokenType::LiquidTagOpen) {
            let tag_name = peek_tag_name(parser);

            if tag_name.as_deref() == Some(end_name.as_str()) {
                let end_pos = parser.peek().start;
                finalize_branch(
                    &current_branch,
                    current_children,
                    end_pos,
                    parser.source,
                    child_filter_mode,
                );
                branches.push(current_branch);
                let end = consume_end_tag(parser)?;
                return Ok((branches, end));
            }

            let branch_name = tag_name
                .as_deref()
                .and_then(is_branch_name)
                .filter(|name| definition_branches.contains(name));
            if let Some(branch_name) = branch_name {
                let end_pos = parser.peek().start;
                finalize_branch(
                    &current_branch,
                    std::mem::take(&mut current_children),
                    end_pos,
                    parser.source,
                    child_filter_mode,
                );
                branches.push(current_branch);

                let open_token = parser.consume(TokenType::LiquidTagOpen)?;
                parser.accept(TokenType::Text);
                let close_token = parser.consume(TokenType::LiquidTagClose)?;
                let branch_envelope = envelope_from_tokens(open_token, close_token, parser.source);

                let branch_markup = parse_branch_markup(parser, branch_name, &branch_envelope);
                current_branch = make_liquid_branch_named(&branch_envelope, branch_markup);
                continue;
            }

            if let Some(inner_name) = tag_name
                .as_deref()
                .and_then(|name| name.strip_prefix("end"))
            {
                // TS `isStructuralEndTag(innerName, ...)`, which is `def !== undefined`.
                if !matches!(tag_for_name(inner_name), TagLookup::Missing) {
                    return Err(close_before_parent_error(inner_name, envelope));
                }
            }
        }
        let progress_start = parser.get_position();
        if parser.in_attribute_context && !parser.in_attribute_value_context {
            current_children.extend(parse_branch_attributes_impl(parser)?);
        } else {
            current_children.push(parser.parse_node()?);
        }
        if parser.get_position() == progress_start {
            if !parser.allow_unclosed_document_node {
                return Err(unexpected_block_tag_error(parser, &envelope.tag_name));
            }
            // Tolerant mode: consume the stalled orphan tag as a degraded node
            // so the loop can still reach the real terminator.
            if parser.check(TokenType::LiquidTagOpen) {
                current_children.push(parse_liquid_tag(parser)?);
                continue;
            }
            break;
        }
    }

    let end_pos = parser.peek().start;
    finalize_branch(
        &current_branch,
        current_children,
        end_pos,
        parser.source,
        child_filter_mode,
    );
    branches.push(current_branch);
    if parser.allow_unclosed_document_node {
        let end = EndTag {
            position: JsVal::position(end_pos, end_pos),
            whitespace: NO_WHITESPACE,
        };
        return Ok((branches, end));
    }

    Err(unclosed_liquid_tag_error(envelope))
}

pub fn finalize_branch(
    branch: &JsVal,
    children: Vec<JsVal>,
    end_pos: usize,
    source: &str,
    mode: ChildFilterMode,
) {
    let all_merged = merge_adjacent_text_nodes(children.clone(), source);
    branch.set(
        "children",
        JsVal::array(filter_children(mode, children, source)),
    );
    branch.set("blockEndPosition", JsVal::position(end_pos, end_pos));
    let position = branch.get("position");
    position.set("end", JsVal::Offset(end_pos));
    let last_child_end = all_merged
        .last()
        .map(|child| child.get("position").get("end"));
    if let Some(last_child_end) = last_child_end.filter(|end| end.offset_after(end_pos, source)) {
        position.set("end", last_child_end);
    }
}

/// The `elsif` and `when` arms of TS `parseBranchMarkup` and
/// `parseLineBranchMarkup`, which differ only in the tokenizer offset.
pub fn parse_branch_markup_at(
    branch_name: BranchName,
    envelope: &LiquidTagEnvelope,
    markup_offset: usize,
    source: &str,
    tolerant: bool,
) -> JsVal {
    let branch_parse = match branch_name {
        BranchName::Elsif => elsif_branch_parse,
        BranchName::When => when_branch_parse,
        BranchName::Else => return JsVal::str(""),
    };
    let tokens = tokenize_markup_at(&envelope.markup_string, markup_offset);
    let mut markup_parser = MarkupParser::new(tokens, source, None, None);
    if tolerant {
        markup_parser.enable_tolerant();
    }
    match branch_parse(&envelope.tag_name, &mut markup_parser) {
        Ok(result) if markup_parser.is_at_end() => result,
        // TS `catch {}`, or markup left after the expression.
        _ => JsVal::str(js_trim(&envelope.markup_string)),
    }
}

// branchMarkup := elsifMarkup | whenMarkup | ""
pub fn parse_branch_markup(
    parser: &DocumentParser<'_>,
    branch_name: BranchName,
    envelope: &LiquidTagEnvelope,
) -> JsVal {
    let close_token_width = if envelope.whitespace_end == "-" { 3 } else { 2 };
    let close_token_start = envelope.block_start_position.get("end").offset() - close_token_width;
    let markup_string_start = close_token_start - envelope.markup_string.len();
    parse_branch_markup_at(
        branch_name,
        envelope,
        markup_string_start,
        parser.source,
        parser.is_tolerant(),
    )
}

/// TS `peekTagName`. `None` is TS `null`; `Some("")` is an empty name.
pub fn peek_tag_name(parser: &DocumentParser<'_>) -> Option<String> {
    if !parser.check(TokenType::LiquidTagOpen) {
        return None;
    }
    let inner = if parser.check_ahead(TokenType::Text, 1) {
        let token = parser.token_at(parser.get_position() + 1);
        &parser.source[token.start..token.end]
    } else {
        ""
    };
    let trimmed = js_trim_start(inner);
    // TS `trimmed.search(/\s/)`
    let name = match trimmed.find(js_is_whitespace) {
        None => js_trim(trimmed),
        Some(first_ws) => &trimmed[..first_ws],
    };
    Some(name.to_string())
}

pub fn is_block_terminator(parser: &DocumentParser<'_>) -> bool {
    if !parser.check(TokenType::LiquidTagOpen) {
        return false;
    }
    let Some(tag_name) = peek_tag_name(parser).filter(|name| !name.is_empty()) else {
        return false;
    };
    tag_name.starts_with("end") || matches!(tag_name.as_str(), "elsif" | "else" | "when")
}

/// A block-body iteration that consumed no tokens: in strict mode this is a
/// clean parse error instead of an endless loop.
fn unexpected_block_tag_error(parser: &DocumentParser<'_>, parent_name: &str) -> ParseError {
    let token = parser.peek();
    // TS `tagName ?? tok.type`
    let tag_name = peek_tag_name(parser).unwrap_or_else(|| token.kind.as_str().to_string());
    ParseError::parsing(
        format!("Unexpected Liquid tag '{tag_name}' inside LiquidTag '{parent_name}'"),
        token.start,
        token.end,
    )
}

pub fn consume_end_tag(parser: &mut DocumentParser<'_>) -> Result<EndTag, ParseError> {
    let open_token = parser.consume(TokenType::LiquidTagOpen)?;
    parser.accept(TokenType::Text);
    let close_token = parser.consume(TokenType::LiquidTagClose)?;
    Ok(EndTag {
        position: JsVal::position(open_token.start, close_token.end),
        whitespace: DelimiterWhitespace {
            start: delimiter_whitespace(open_token),
            end: delimiter_whitespace(close_token),
        },
    })
}

/// TS `isBranchName(value)`, returning the branch it names.
pub fn is_branch_name(value: &str) -> Option<BranchName> {
    match value {
        "elsif" => Some(BranchName::Elsif),
        "else" => Some(BranchName::Else),
        "when" => Some(BranchName::When),
        _ => None,
    }
}
