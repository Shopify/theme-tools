//! `checks/liquid-syntax-error/case.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup};

pub fn check_case_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Node(markup) => markup,
        Markup::Str(_) => return cx.report("Syntax error in 'case' tag", start, end),
        _ => return,
    };
    let source = cx.source();

    if has_unclosed_quoted_string(&Scan::new(raw_markup(source, node.markup_position))) {
        return cx.report("Syntax error in 'case' tag", start, end);
    }

    if has_bare_array_access(markup) {
        return cx.report("Bare bracket access is not allowed", start, end);
    }

    if has_skipped_characters(&Scan::new(js_slice(
        source,
        markup.position().start,
        node.markup_position.end,
    ))) {
        cx.report("Syntax error in 'case' tag", start, end);
    }
}
