//! `checks/liquid-syntax-error/sections.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidTag;

pub fn check_sections_tag(node: &LiquidTag, cx: &mut Context) {
    if node.markup.is_str()
        || has_skipped_characters(&Scan::new(raw_markup(cx.source(), node.markup_position)))
    {
        cx.report(
            "Syntax error in 'sections' tag",
            node.position.start,
            node.position.end,
        );
    }
}
