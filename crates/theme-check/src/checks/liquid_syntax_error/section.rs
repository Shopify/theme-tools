//! `checks/liquid-syntax-error/section.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};

pub fn check_section_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (
        node.block_start_position.start,
        node.block_start_position.end,
    );
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::SectionMarkup(m) => m,
            _ => return,
        },
        Markup::Str(_) => return cx.report("Syntax error in 'section' tag", start, end),
        _ => return,
    };

    // A `BlockArrayLiteral` value is never a bare bracket lookup.
    if markup.args.iter().any(|a| has_bare_array_access(&a.value)) {
        return cx.report(
            "Bare bracket access is not allowed in strict2 mode",
            start,
            end,
        );
    }

    if has_skipped_characters(&Scan::new(raw_markup(cx.source(), node.markup_position))) {
        cx.report("Syntax error in 'section' tag", start, end);
    }
}
