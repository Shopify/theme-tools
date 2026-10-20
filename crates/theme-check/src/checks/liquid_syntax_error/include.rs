//! `checks/liquid-syntax-error/include.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};

pub fn check_include_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::RenderMarkup(m) => m,
            _ => return,
        },
        Markup::Str(markup) => {
            if !has_ruby_accepted_include_markup(&Scan::new(markup)) {
                cx.report("Syntax error in 'include' tag", start, end);
            }
            return;
        }
        _ => return,
    };

    if has_bare_array_access(&markup.snippet)
        || markup
            .variable
            .as_ref()
            .is_some_and(|v| has_bare_array_access(&v.name))
        || markup.args.iter().any(|a| has_bare_array_access(&a.value))
    {
        return cx.report(
            "Bare bracket access is not allowed in strict2 mode",
            start,
            end,
        );
    }

    if has_skipped_characters(&Scan::new(raw_markup(cx.source(), node.markup_position))) {
        cx.report("Syntax error in 'include' tag", start, end);
    }
}
