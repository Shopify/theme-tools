//! `checks/liquid-syntax-error/javascript.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidRawTag;
use liquid_parser::ParseError;

const SYNTAX_ERROR: &str = "Syntax Error in 'javascript' - Valid syntax: javascript";
const UNCLOSED_ERROR: &str = "'javascript' tag was never closed";
const UNKNOWN_END_ERROR: &str = "Unknown tag 'endjavascript'";
const UNCLOSED_PARSER_ERROR: &str =
    "Attempting to end parsing before LiquidRawTag 'javascript' was closed";
const UNOPENED_PARSER_ERROR: &str =
    "Attempting to close LiquidTag 'javascript' before it was opened without a matching 'javascript'";

pub fn check_javascript_tag(node: &LiquidRawTag, cx: &mut Context) {
    if has_empty_markup(&Scan::new(raw_markup(cx.source(), node.markup_position))) {
        return;
    }
    cx.report(
        SYNTAX_ERROR,
        node.block_start_position.start,
        node.block_start_position.end,
    );
}

pub fn check_javascript_parser_error(error: &ParseError, cx: &mut Context, source: &str) {
    // Both messages are checked before `hasJavascriptParserTag` scans the source; neither check
    // has side effects.
    if error.message != UNOPENED_PARSER_ERROR && error.message != UNCLOSED_PARSER_ERROR {
        return;
    }
    let tags = liquid_tag_bodies(source, 0);
    let tag_named = |tag: &LiquidTagBody, names: &[&str]| {
        liquid_tag_markup(tag.body).is_some_and(|m| names.contains(&m.tag_name))
    };
    // `hasJavascriptParserTag`: its `hasLiquidTagNamed` checks are implied by the loop after them.
    if !tags
        .iter()
        .any(|tag| tag_named(tag, &["javascript", "endjavascript"]))
    {
        return;
    }

    if error.message == UNOPENED_PARSER_ERROR {
        let (start, end) = resolve_error_location(error, source);
        return cx.report(UNKNOWN_END_ERROR, start, end);
    }

    // `findInvalidJavascriptOpening`
    let invalid_opening = tags.iter().find(|tag| {
        liquid_tag_markup(tag.body).is_some_and(|m| {
            m.tag_name == "javascript" && (m.remaining_tokens > 0 || m.has_skipped_characters)
        })
    });
    if let Some(tag) = invalid_opening {
        return cx.report(SYNTAX_ERROR, tag.start, tag.end);
    }

    let (start, end) = resolve_error_location(error, source);

    // Ruby accepts markup on the closing javascript tag, while the local raw-tag scanner only
    // recognizes bare closing tags. Treat that parser gap as valid.
    if has_javascript_closing_tag_after(&tags, start) {
        return;
    }

    cx.report(UNCLOSED_ERROR, start, end);
}

/// `hasJavascriptClosingTagAfter(source, startIndex)` over the source's tags.
fn has_javascript_closing_tag_after(tags: &[LiquidTagBody], start: usize) -> bool {
    tags.iter()
        .filter(|tag| tag.start >= start)
        .any(|tag| liquid_tag_markup(tag.body).is_some_and(|m| m.tag_name == "endjavascript"))
}
