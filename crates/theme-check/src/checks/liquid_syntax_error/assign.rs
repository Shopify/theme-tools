//! `checks/liquid-syntax-error/assign.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};

const SYNTAX_ERROR: &str = "Syntax error in 'assign' tag";

pub fn check_assign_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.position.start, node.position.end);
    let markup = match &node.markup {
        Markup::Str(markup) => {
            if !is_ruby_accepted_assign(&Scan::new(markup)) {
                cx.report(SYNTAX_ERROR, start, end);
            }
            return;
        }
        Markup::Node(n) => match n.as_ref() {
            Node::AssignMarkup(m) => m,
            _ => return,
        },
        _ => return,
    };

    if variable_has_bare_array_access(&markup.value) {
        cx.report("Bare bracket access is not allowed", start, end);
        return;
    }

    let source = cx.source();
    if has_skipped_prefix_characters(source, node.markup_position.start, markup.position.start) {
        cx.report(SYNTAX_ERROR, start, end);
        return;
    }

    if is_ruby_accepted_assign(&Scan::new(raw_markup(source, node.markup_position))) {
        return;
    }

    let parsed_raw = js_slice(source, markup.position.start, node.markup_position.end);
    if has_skipped_characters(&Scan::new(parsed_raw)) {
        cx.report(SYNTAX_ERROR, start, end);
    }
}

fn is_ruby_accepted_assign(m: &Scan) -> bool {
    has_ruby_accepted_empty_assign_rhs(m)
        || has_ruby_accepted_empty_first_filter_argument(m)
        || has_ruby_accepted_filter_argument_trailing_comma(m)
        || has_ruby_accepted_assign_lhs_extra_identifier(m)
}
