//! `checks/liquid-syntax-error/paginate.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};

pub fn check_paginate_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (
        node.block_start_position.start,
        node.block_start_position.end,
    );
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::PaginateMarkup(m) => m,
            _ => return,
        },
        Markup::Str(markup) => {
            if !has_ruby_accepted_paginate_trailing_comma(&Scan::new(markup)) {
                cx.report("Syntax error in 'paginate' tag", start, end);
            }
            return;
        }
        _ => return,
    };

    if has_bare_array_access(&markup.collection)
        || has_bare_array_access(&markup.page_size)
        || markup.args.iter().any(|a| has_bare_array_access(&a.value))
    {
        return cx.report("Bare bracket access is not allowed", start, end);
    }

    let source = cx.source();
    if has_skipped_prefix_characters(source, node.markup_position.start, markup.position.start) {
        return cx.report("Syntax error in 'paginate' tag", start, end);
    }

    if has_skipped_characters(&Scan::new(js_slice(
        source,
        markup.position.start,
        node.markup_position.end,
    ))) {
        cx.report("Syntax error in 'paginate' tag", start, end);
    }
}
