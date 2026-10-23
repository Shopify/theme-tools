//! `checks/liquid-syntax-error/partial.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};
use liquid_parser::ParseError;

const SYNTAX_ERROR: &str = "Syntax error in 'partial' tag";
const UNCLOSED_PARTIAL_PARSER_ERROR: &str =
    "Attempting to end parsing before LiquidTag 'partial' was closed";
const UNCLOSED_PARTIAL_IN_LIQUID_PARSER_ERROR: &str =
    "Unclosed block tag 'partial' in {% liquid %} block";
const PARTIAL_PARSER_ERROR_MESSAGES: &[&str] = &[
    UNCLOSED_PARTIAL_PARSER_ERROR,
    UNCLOSED_PARTIAL_IN_LIQUID_PARSER_ERROR,
    "Attempting to close LiquidTag 'partial' before it was opened without a matching 'partial'",
];

pub fn check_partial_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::String(m) => m,
            _ => return,
        },
        Markup::Str(_) => return cx.report(SYNTAX_ERROR, start, end),
        _ => return,
    };

    if markup.value.is_empty() || markup.value.contains('/') {
        return cx.report(
            "Liquid syntax error: Error in tag 'partial' - Valid syntax: partial '[name]'",
            start,
            end,
        );
    }

    if has_skipped_characters(&Scan::new(raw_markup(cx.source(), node.markup_position))) {
        cx.report(SYNTAX_ERROR, start, end);
    }
}

pub fn check_partial_parser_error(error: &ParseError, cx: &mut Context, source: &str) {
    if !PARTIAL_PARSER_ERROR_MESSAGES.contains(&error.message.as_str()) {
        return;
    }

    let (start, end) = if error
        .message
        .contains(UNCLOSED_PARTIAL_IN_LIQUID_PARSER_ERROR)
    {
        liquid_line_tag_location(source, "partial")
            .unwrap_or_else(|| resolve_error_location(error, source))
    } else {
        resolve_error_location(error, source)
    };

    let message = if error.message == UNCLOSED_PARTIAL_PARSER_ERROR {
        "Liquid syntax error: 'partial' tag was never closed"
    } else {
        &error.message
    };
    cx.report(message, start, end);
}
