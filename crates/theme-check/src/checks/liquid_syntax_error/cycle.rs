//! `checks/liquid-syntax-error/cycle.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};

pub fn check_cycle_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::CycleMarkup(m) => m,
            _ => return,
        },
        Markup::Str(markup) => {
            if !has_ruby_accepted_cycle_trailing_comma(&Scan::new(markup)) {
                cx.report("Syntax error in 'cycle' tag", start, end);
            }
            return;
        }
        _ => return,
    };

    if markup
        .group_name
        .as_deref()
        .is_some_and(has_bare_array_access)
        || markup.args.iter().any(has_bare_array_access)
    {
        return cx.report("Bare bracket access is not allowed", start, end);
    }

    if has_skipped_characters(&Scan::new(raw_markup(cx.source(), node.markup_position))) {
        cx.report("Syntax error in 'cycle' tag", start, end);
    }
}
