//! `checks/liquid-syntax-error/inline_comment.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidTag;

pub fn check_inline_comment_tag(node: &LiquidTag, cx: &mut Context) {
    if has_ruby_valid_inline_comment_markup(&Scan::new(raw_markup(
        cx.source(),
        node.markup_position,
    ))) {
        return;
    }
    cx.report(
        "Syntax error in tag '#' - Each line of comments must be prefixed by the '#' character",
        node.position.start,
        node.position.end,
    );
}
