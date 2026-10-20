//! `checks/liquid-syntax-error/schema.ts`

use crate::context::Context;
use liquid_ast::LiquidRawTag;

pub fn check_schema_tag(node: &LiquidRawTag, cx: &mut Context) {
    if !node.markup.is_empty() {
        cx.report(
            "Syntax error in 'schema' tag",
            node.markup_position.start,
            node.markup_position.end,
        );
    }
}
