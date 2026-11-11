//! `checks/liquid-syntax-error/case.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::Span;
use liquid_ast::{LiquidTag, Markup};

pub fn check_case_tag(node: &LiquidTag, cx: &mut Context) {
    let (start, end) = (node.span.start, node.span.end);
    let markup = match &node.markup {
        Markup::Node(markup) => markup,
        Markup::Str(_) => return cx.report("Syntax error in 'case' tag", Span::new(start, end)),
        _ => return,
    };
    let source = cx.source();

    if has_unclosed_quoted_string(&Scan::new(raw_markup(source, node.markup_span))) {
        return cx.report("Syntax error in 'case' tag", Span::new(start, end));
    }

    if has_bare_array_access(markup) {
        return cx.report("Bare bracket access is not allowed", Span::new(start, end));
    }

    if has_skipped_characters(&Scan::new(js_slice(
        source,
        markup.span().start,
        node.markup_span.end,
    ))) {
        cx.report("Syntax error in 'case' tag", Span::new(start, end));
    }
}
