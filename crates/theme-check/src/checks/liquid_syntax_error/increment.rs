//! `checks/liquid-syntax-error/increment.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidTag;

pub fn check_increment_tag(node: &LiquidTag, cx: &mut Context) {
    if node.markup.is_str()
        || node.markup.node().is_some_and(has_bare_array_access)
        || has_skipped_characters(&Scan::new(raw_markup(cx.source(), node.markup_position)))
    {
        cx.report(
            "Syntax error in 'increment' tag",
            node.position.start,
            node.position.end,
        );
    }
}
