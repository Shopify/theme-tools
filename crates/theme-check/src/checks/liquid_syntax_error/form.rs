//! `checks/liquid-syntax-error/form.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};

const SYNTAX_ERROR: &str = "Syntax error in 'form' tag";
const BARE_ARRAY_ACCESS: &str = "Bare bracket access is not allowed in strict2 mode";

pub fn check_form_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let args = match &node.markup {
        Markup::Nodes(args) => args,
        Markup::Str(_) => return cx.report(SYNTAX_ERROR, start, end),
        _ => return,
    };

    if args.iter().any(arg_has_bare_array_access) {
        return cx.report(BARE_ARRAY_ACCESS, start, end);
    }

    if has_invalid_argument_order(args) {
        return cx.report(SYNTAX_ERROR, start, end);
    }

    if has_skipped_characters(&Scan::new(raw_markup(cx.source(), node.markup_position))) {
        cx.report(SYNTAX_ERROR, start, end);
    }
}

fn has_invalid_argument_order(args: &[Node]) -> bool {
    let is_named = |arg: &Node| matches!(arg, Node::NamedArgument(_));
    let Some(first) = args.first() else {
        return true;
    };
    if is_named(first) {
        return true;
    }

    let mut positional_count = 1;
    let mut seen_named_argument = false;
    for arg in &args[1..] {
        if is_named(arg) {
            seen_named_argument = true;
            continue;
        }
        positional_count += 1;
        if seen_named_argument || positional_count > 2 {
            return true;
        }
    }
    false
}
