//! `checks/liquid-syntax-error/comment.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidRawTag;
use liquid_parser::{tokenize, ParseError, Token, TokenType};

const COMMENT_RAW_BODY_ERROR: &str = "Liquid syntax error: 'comment' tag was never closed";
pub const UNMATCHED_COMMENT_CLOSE_PARSER_ERROR: &str =
    "Attempting to close LiquidTag 'comment' before it was opened without a matching 'comment'";
pub const UNMATCHED_RAW_CLOSE_PARSER_ERROR: &str =
    "Attempting to close LiquidTag 'raw' before it was opened without a matching 'raw'";
const UNCLOSED_COMMENT_PARSER_ERROR: &str =
    "Attempting to end parsing before LiquidRawTag 'comment' was closed";

pub fn check_comment_tag(error: &ParseError, cx: &mut Context, source: &str) {
    if !is_comment_parser_error(error, source) {
        return;
    }

    let (start, end) = resolve_error_location(error, source);

    if error.message == UNCLOSED_COMMENT_PARSER_ERROR
        && has_nested_comment_tag(comment_tag_body(source, start))
    {
        return cx.report(COMMENT_RAW_BODY_ERROR, start, end);
    }

    if error.message == UNMATCHED_COMMENT_CLOSE_PARSER_ERROR
        && has_ruby_accepted_inert_comment_body_closer(source, "comment", start)
    {
        return;
    }

    cx.report(&error.message, start, end);
}

/// The body of a raw tag is everything after its opening `{% ... %}`. For an unclosed comment
/// that runs to end-of-source, that is the remainder.
fn comment_tag_body(source: &str, start: usize) -> &str {
    match source.get(start..).and_then(|s| s.find("%}")) {
        Some(i) => &source[start + i + 2..],
        None => "",
    }
}

/// True when the (unclosed) comment body itself opens another comment tag, i.e. the failure is
/// nesting, not a plain later-unclosed comment.
fn has_nested_comment_tag(body: &str) -> bool {
    liquid_tag_bodies(body, 0).iter().any(|tag| {
        liquid_tag_markup(tag.body)
            .is_some_and(|m| m.tag_name == "comment" && !m.has_skipped_characters)
    })
}

pub fn check_comment_raw_tag(node: &LiquidRawTag, cx: &mut Context) {
    let body = &*node.body.value;
    let source = cx.source();
    let body_tokens = tokenize(body);
    let body_tags = liquid_tag_bodies_in(body, &body_tokens, 0);
    let after = node.block_end_position.end;

    if has_unbalanced_nested_tags(&body_tags, source, after, "comment")
        || has_unbalanced_nested_tags(&body_tags, source, after, "raw")
        || has_unclosed_liquid_delimiter(&body_tokens)
    {
        cx.report(
            COMMENT_RAW_BODY_ERROR,
            node.body.position.start,
            node.body.position.end,
        );
    }
}

fn is_comment_parser_error(error: &ParseError, source: &str) -> bool {
    (error.message == UNCLOSED_COMMENT_PARSER_ERROR
        || error.message == UNMATCHED_COMMENT_CLOSE_PARSER_ERROR)
        && (has_complete_liquid_tag(source, "comment")
            || has_complete_liquid_tag(source, "endcomment"))
}

fn has_unclosed_liquid_delimiter(tokens: &[Token]) -> bool {
    for (i, open) in tokens.iter().enumerate() {
        let text = tokens.get(i + 1);
        let close = if text.is_some_and(|t| t.kind == TokenType::Text) {
            tokens.get(i + 2)
        } else {
            text
        };
        let close = close.map(|c| c.kind);

        if open.kind == TokenType::LiquidTagOpen {
            if close != Some(TokenType::LiquidTagClose) {
                return true;
            }
            continue;
        }

        if open.kind == TokenType::LiquidVariableOutputOpen
            && close != Some(TokenType::LiquidVariableOutputClose)
        {
            return true;
        }
    }
    false
}

/// `hasUnbalancedNestedTags(body, source, sourceAfterClosingTagStart, tagName)`, over the body's
/// tags.
fn has_unbalanced_nested_tags(
    body_tags: &[LiquidTagBody],
    source: &str,
    after: usize,
    tag_name: &str,
) -> bool {
    let mut depth = tag_nesting_depth(body_tags, tag_name);
    if depth == 0 {
        return false;
    }

    for tag in liquid_tag_bodies(source, after) {
        let Some(markup) = liquid_tag_markup(tag.body) else {
            continue;
        };
        if markup.has_skipped_characters {
            continue;
        }
        if markup.tag_name == tag_name {
            depth += 1;
            continue;
        }
        if is_end_tag(markup.tag_name, tag_name) {
            depth -= 1;
            if depth == 0 {
                return false;
            }
        }
    }
    true
}

fn tag_nesting_depth(body_tags: &[LiquidTagBody], tag_name: &str) -> usize {
    let mut depth = 0;
    for tag in body_tags {
        let Some(markup) = liquid_tag_markup(tag.body) else {
            continue;
        };
        if markup.has_skipped_characters {
            continue;
        }
        if markup.tag_name == tag_name {
            depth += 1;
        } else if is_end_tag(markup.tag_name, tag_name) && depth > 0 {
            depth -= 1;
        }
    }
    depth
}

fn count_liquid_tag(source: &str, tag_name: &str, start: usize, end: usize) -> usize {
    liquid_tag_bodies(source, start)
        .iter()
        .filter(|tag| {
            tag.body_start < end
                && liquid_tag_markup(tag.body)
                    .is_some_and(|m| m.tag_name == tag_name && !m.has_skipped_characters)
        })
        .count()
}

pub fn has_ruby_accepted_inert_comment_body_closer(
    source: &str,
    tag_name: &str,
    start: usize,
) -> bool {
    let Some(closer) = liquid_tag_at(source, start) else {
        return false;
    };
    if !is_end_tag(closer.tag_name, tag_name) || closer.has_skipped_characters {
        return false;
    }

    let len = source.len();
    if tag_name == "comment" {
        return count_liquid_tag(source, "comment", 0, start)
            > count_liquid_tag(source, "endcomment", 0, start);
    }

    count_liquid_tag(source, "raw", 0, start) > count_liquid_tag(source, "endraw", 0, start)
        && count_liquid_tag(source, "comment", 0, start) > 0
        && count_liquid_tag(source, "endcomment", start, len) > 0
}

fn has_complete_liquid_tag(source: &str, tag_name: &str) -> bool {
    count_liquid_tag(source, tag_name, 0, source.len()) > 0
}

fn liquid_tag_at(source: &str, start: usize) -> Option<LiquidTagMarkup<'_>> {
    let tokens = tokenize(source);
    let i = tokens
        .iter()
        .position(|t| t.kind == TokenType::LiquidTagOpen && t.start == start)?;
    let text = tokens.get(i + 1).filter(|t| t.kind == TokenType::Text);
    let close = if text.is_some() {
        tokens.get(i + 2)
    } else {
        tokens.get(i + 1)
    };
    if !close.is_some_and(|c| c.kind == TokenType::LiquidTagClose) {
        return None;
    }
    liquid_tag_markup(text.map_or("", |t| &source[t.start..t.end]))
}
