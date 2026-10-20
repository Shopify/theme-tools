//! `checks/liquid-syntax-error/layout.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup};

pub fn check_layout_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Node(markup) => markup,
        Markup::Str(_) => return cx.report("Syntax error in 'layout' tag", start, end),
        _ => return,
    };

    if has_bare_array_access(markup) {
        return cx.report(
            "Bare bracket access is not allowed in strict2 mode",
            start,
            end,
        );
    }

    if has_skipped_characters(&Scan::new(raw_markup(cx.source(), node.markup_position))) {
        cx.report("Syntax error in 'layout' tag", start, end);
    }
}
