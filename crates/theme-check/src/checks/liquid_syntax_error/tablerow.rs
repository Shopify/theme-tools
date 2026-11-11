//! `checks/liquid-syntax-error/tablerow.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::Span;
use liquid_ast::{LiquidTag, Markup, Node};

pub fn check_tablerow_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.span.start, node.span.end);
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::ForMarkup(m) => m,
            _ => return,
        },
        Markup::Str(markup) => {
            if !has_ruby_accepted_loop_trailing_comma(&Scan::new(markup)) {
                cx.report("Syntax error in 'tablerow' tag", Span::new(start, end));
            }
            return;
        }
        _ => return,
    };

    if has_bare_array_access(&markup.collection)
        || markup.args.iter().any(|a| has_bare_array_access(&a.value))
    {
        return cx.report("Bare bracket access is not allowed", Span::new(start, end));
    }

    let source = cx.source();
    if has_skipped_prefix_characters(source, node.markup_span.start, markup.span.start) {
        return cx.report("Syntax error in 'tablerow' tag", Span::new(start, end));
    }

    if has_skipped_characters(&Scan::new(js_slice(
        source,
        markup.span.start,
        node.markup_span.end,
    ))) {
        cx.report("Syntax error in 'tablerow' tag", Span::new(start, end));
    }
}
