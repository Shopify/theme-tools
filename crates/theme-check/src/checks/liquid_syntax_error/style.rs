//! `checks/liquid-syntax-error/style.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidRawTag;

pub fn check_style_tag(node: &LiquidRawTag, cx: &mut Context) {
    let markup = raw_markup(cx.source(), node.markup_position);
    if has_empty_markup(&Scan::new(markup)) {
        return;
    }
    cx.report(
        format!("'style' tag does not accept any arguments in \"{markup}\""),
        node.block_start_position.start,
        node.block_start_position.end,
    );
}
