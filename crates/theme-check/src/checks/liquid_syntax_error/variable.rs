//! `checks/liquid-syntax-error/variable.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::Span;
use liquid_ast::{LiquidVariableOutput, Markup, Node};

const SYNTAX_ERROR: &str = "Syntax error in variable output";

pub fn check_variable_output(node: &LiquidVariableOutput, cx: &mut Context) {
    let (start, end) = (node.span.start, node.span.end);
    let raw = Scan::new(js_slice(
        cx.source(),
        node.markup_span.start,
        node.markup_span.end,
    ));

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
            return cx.report(SYNTAX_ERROR, Span::new(start, end));
        }
        _ => return,
    };

    if has_ruby_accepted_empty_first_filter_argument(&raw)
        || has_ruby_accepted_filter_argument_trailing_comma(&raw)
    {
        return;
    }

    if has_unclosed_quoted_string(&raw) {
        return cx.report(SYNTAX_ERROR, Span::new(start, end));
    }

    if variable_has_bare_array_access(markup) {
        return cx.report(
            "Bare bracket access is not allowed in strict2 mode",
            Span::new(start, end),
        );
    }

    if has_skipped_characters(&raw) {
        cx.report(SYNTAX_ERROR, Span::new(start, end));
    }
}
