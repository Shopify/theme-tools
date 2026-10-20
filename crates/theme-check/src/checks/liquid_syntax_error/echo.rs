//! `checks/liquid-syntax-error/echo.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};

pub fn check_echo_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let raw = Scan::new(raw_markup(cx.source(), node.markup_position));
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::LiquidVariable(m) => m,
            _ => return,
        },
        Markup::Str(markup) => {
            if has_empty_markup(&raw) {
                return;
            }
            let markup = Scan::new(markup);
            if has_ruby_accepted_empty_first_filter_argument(&markup)
                || has_ruby_accepted_filter_argument_trailing_comma(&markup)
            {
                return;
            }
            return cx.report("Syntax error in 'echo' tag", start, end);
        }
        _ => return,
    };

    if variable_has_bare_array_access(markup) {
        return cx.report("Bare bracket access is not allowed", start, end);
    }

    if has_ruby_accepted_empty_first_filter_argument(&raw)
        || has_ruby_accepted_filter_argument_trailing_comma(&raw)
    {
        return;
    }

    if has_skipped_characters(&raw) {
        cx.report("Syntax error in 'echo' tag", start, end);
    }
}
