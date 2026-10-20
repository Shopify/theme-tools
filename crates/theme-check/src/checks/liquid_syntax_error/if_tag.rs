//! `checks/liquid-syntax-error/if.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup};

pub fn check_if_tag(node: &LiquidTag, cx: &mut Context) {
    check_conditional_tag(node, cx, "Syntax error in 'if' tag");
}

/// `checkIfTag`, also `checkUnlessTag` (same steps, its own message).
pub fn check_conditional_tag(node: &LiquidTag, cx: &mut Context, syntax_error: &'static str) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Node(markup) => markup,
        Markup::Str(_) => return cx.report(syntax_error, start, end),
        _ => return,
    };
    let source = cx.source();

    if has_unclosed_quoted_string(&Scan::new(raw_markup(source, node.markup_position))) {
        return cx.report(syntax_error, start, end);
    }

    if conditional_has_bare_array_access(markup) {
        return cx.report(
            "Bare bracket access is not allowed in strict2 mode",
            start,
            end,
        );
    }

    let markup_start = markup.position().start;
    if has_skipped_prefix_characters(source, node.markup_position.start, markup_start) {
        return cx.report(syntax_error, start, end);
    }

    if has_skipped_characters(&Scan::new(js_slice(
        source,
        markup_start,
        node.markup_position.end,
    ))) {
        cx.report(syntax_error, start, end);
    }
}
