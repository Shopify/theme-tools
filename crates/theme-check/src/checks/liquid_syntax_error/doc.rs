//! `checks/liquid-syntax-error/doc.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidRawTag;
use liquid_parser::ParseError;

const UNCLOSED_DOC_PARSER_ERROR: &str =
    "Attempting to end parsing before LiquidRawTag 'doc' was closed";
const UNOPENED_DOC_PARSER_ERROR: &str =
    "Attempting to close LiquidTag 'doc' before it was opened without a matching 'doc'";

pub fn check_doc_tag(node: &LiquidRawTag, cx: &mut Context) {
    if !node.markup.is_empty() {
        return cx.report(
            "Syntax error in 'doc' tag",
            node.block_start_position.start,
            node.block_start_position.end,
        );
    }

    if has_nested_doc_tag(&node.body.value) {
        cx.report(
            "Nested doc tags are not allowed",
            node.body.position.start,
            node.body.position.end,
        );
    }
}

fn has_nested_doc_tag(body: &str) -> bool {
    for tag in liquid_tag_bodies(body, 0) {
        let Some(markup) = liquid_tag_markup(tag.body) else {
            continue;
        };
        if markup.tag_name == "enddoc"
            && markup.remaining_tokens > 0
            && !markup.has_skipped_characters
        {
            return false;
        }
        if markup.tag_name == "doc" && !markup.has_skipped_characters {
            return true;
        }
    }
    false
}

pub fn check_doc_parser_error(error: &ParseError, cx: &mut Context, source: &str) {
    if !is_doc_parser_error(error, source) {
        return;
    }

    let (start, end) = resolve_error_location(error, source);

    // A doc tag that fails to close because it wraps another doc tag is a nesting error, not a
    // generic unclosed-tag error. `hasNestedDocTag` ignores an `enddoc` that carries markup (a
    // Ruby-accepted closer), so a genuinely-later-unclosed doc still falls through to the raw
    // passthrough.
    if error.message == UNCLOSED_DOC_PARSER_ERROR && has_nested_doc_tag(doc_tag_body(source, start))
    {
        return cx.report("Nested doc tags are not allowed", start, end);
    }

    if error.message == UNCLOSED_DOC_PARSER_ERROR
        && has_ruby_accepted_raw_tag_closer_with_markup(source, "doc", start)
    {
        return;
    }

    cx.report(&error.message, start, end);
}

/// The body of a raw tag is everything after its opening `{% ... %}`. For an unclosed tag that
/// runs to end-of-source, that is the remainder of the file.
fn doc_tag_body(source: &str, start: usize) -> &str {
    match source.get(start..).and_then(|s| s.find("%}")) {
        Some(i) => &source[start + i + 2..],
        None => "",
    }
}

pub fn is_doc_parser_error(error: &ParseError, source: &str) -> bool {
    (error.message == UNCLOSED_DOC_PARSER_ERROR || error.message == UNOPENED_DOC_PARSER_ERROR)
        && (has_liquid_tag_named(source, "doc") || has_liquid_tag_named(source, "enddoc"))
}
