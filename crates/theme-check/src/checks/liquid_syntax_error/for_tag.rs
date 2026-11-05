//! `checks/liquid-syntax-error/for.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};

pub fn check_for_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::ForMarkup(m) => m,
            _ => return,
        },
        Markup::Str(_) => return cx.report("Syntax error in 'for' tag", start, end),
        _ => return,
    };

    if has_bare_array_access(&markup.collection) {
        return cx.report("Bare bracket access is not allowed", start, end);
    }

    let source = cx.source();
    if has_skipped_prefix_characters(source, node.markup_position.start, markup.position.start) {
        return cx.report("Syntax error in 'for' tag", start, end);
    }

    if has_skipped_characters(&Scan::new(js_slice(
        source,
        markup.position.start,
        node.markup_position.end,
    ))) {
        cx.report("Syntax error in 'for' tag", start, end);
    }
}
