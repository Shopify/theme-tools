//! `checks/liquid-syntax-error/raw.ts`

use super::comment::{
    has_ruby_accepted_inert_comment_body_closer, UNMATCHED_RAW_CLOSE_PARSER_ERROR,
};
use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidRawTag;
use liquid_parser::ParseError;

const UNCLOSED_RAW_PARSER_ERROR: &str =
    "Attempting to end parsing before LiquidRawTag 'raw' was closed";
const RAW_PARSER_ERROR_MESSAGES: &[&str] = &[
    UNCLOSED_RAW_PARSER_ERROR,
    UNMATCHED_RAW_CLOSE_PARSER_ERROR,
    "Unclosed raw tag 'raw' in {% liquid %} block",
];

pub fn check_raw_tag(node: &LiquidRawTag, cx: &mut Context) {
    let (start, end) = (node.markup_position.start, node.markup_position.end);
    let source = cx.source();
    if !node.markup.is_empty()
        || has_skipped_prefix_characters(source, start, end)
        || has_skipped_characters(&Scan::new(raw_markup(source, node.markup_position)))
    {
        cx.report("Syntax error in 'raw' tag", start, end);
    }
}

pub fn check_raw_parser_error(error: &ParseError, cx: &mut Context, source: &str) {
    if !RAW_PARSER_ERROR_MESSAGES.contains(&error.message.as_str()) {
        return;
    }

    let (start, end) = resolve_error_location(error, source);

    if error.message == UNCLOSED_RAW_PARSER_ERROR
        && has_ruby_accepted_raw_tag_closer_with_markup(source, "raw", start)
    {
        return;
    }

    if error.message == UNMATCHED_RAW_CLOSE_PARSER_ERROR
        && has_ruby_accepted_inert_comment_body_closer(source, "raw", start)
    {
        return;
    }

    cx.report(&error.message, start, end);
}
