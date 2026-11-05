//! `checks/liquid-syntax-error/render.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node, RenderMarkup};

const SYNTAX_ERROR: &str = "Syntax error in 'render' tag";
const BARE_ARRAY_ACCESS: &str = "Bare bracket access is not allowed in strict2 mode";

pub fn check_render_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::RenderMarkup(m) => m,
            _ => return,
        },
        Markup::Str(_) => return cx.report(SYNTAX_ERROR, start, end),
        _ => return,
    };
    let source = cx.source();

    if has_unclosed_quoted_string(&Scan::new(raw_markup(source, node.markup_position))) {
        return cx.report(SYNTAX_ERROR, start, end);
    }

    if has_render_bare_array_access(markup) {
        return cx.report(BARE_ARRAY_ACCESS, start, end);
    }

    if has_skipped_prefix_characters(source, node.markup_position.start, markup.position.start) {
        return cx.report(SYNTAX_ERROR, start, end);
    }

    if has_skipped_characters(&Scan::new(js_slice(
        source,
        markup.position.start,
        node.markup_position.end,
    ))) {
        cx.report(SYNTAX_ERROR, start, end);
    }
}

fn has_render_bare_array_access(markup: &RenderMarkup) -> bool {
    has_bare_array_access(&markup.snippet)
        || markup
            .variable
            .as_ref()
            .is_some_and(|v| has_bare_array_access(&v.name))
        || markup.args.iter().any(|a| has_bare_array_access(&a.value))
}
