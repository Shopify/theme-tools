//! `checks/liquid-syntax-error/unless.ts`: the same steps as `if.ts`.

use super::if_tag::check_conditional_tag;
use crate::context::Context;
use liquid_ast::LiquidTag;

pub fn check_unless_tag(node: &LiquidTag, cx: &mut Context) {
    check_conditional_tag(node, cx, "Syntax error in 'unless' tag");
}
