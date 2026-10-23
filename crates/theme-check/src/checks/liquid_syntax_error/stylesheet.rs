//! `checks/liquid-syntax-error/stylesheet.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::LiquidRawTag;

pub fn check_stylesheet_tag(node: &LiquidRawTag, cx: &mut Context) {
    let markup = raw_markup(cx.source(), node.markup_position);
    let scan = Scan::new(markup);
    if has_empty_markup(&scan) || has_single_string_markup(&scan, "scss") {
        return;
    }
    cx.report(
        format!("'stylesheet' tag can only accept the string argument 'scss' in \"{markup}\""),
        node.block_start_position.start,
        node.block_start_position.end,
    );
}
