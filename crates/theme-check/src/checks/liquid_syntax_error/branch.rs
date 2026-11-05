//! `checks/liquid-syntax-error/branch.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{LiquidBranch, LiquidTag, Markup};

const ELSIF_BARE_ARRAY_ACCESS: &str = "Bare bracket access is not allowed in strict2 mode";

pub fn check_branch_tag(node: &LiquidBranch, cx: &mut Context) {
    match node.name.as_deref() {
        Some("elsif") => check_elsif_branch(node, cx),
        Some("when") => check_when_branch(node, cx),
        _ => {}
    }
}

pub fn check_misplaced_branch_tag(node: &LiquidTag, cx: &mut Context) {
    cx.report(
        format!("Unknown tag '{}'", node.name),
        node.position.start,
        node.position.end,
    );
}

fn check_when_branch(node: &LiquidBranch, cx: &mut Context) {
    let (start, end) = (
        node.block_start_position.start,
        node.block_start_position.end,
    );
    let markup = match &node.markup {
        Markup::Nodes(markup) => markup,
        Markup::Str(_) => return cx.report("Syntax error in 'when' tag", start, end),
        _ => return,
    };
    let source = cx.source();

    if has_unclosed_quoted_string(&Scan::new(raw_markup(source, node.markup_position))) {
        return cx.report("Syntax error in 'when' tag", start, end);
    }

    if markup.iter().any(has_bare_array_access) {
        return cx.report("Bare bracket access is not allowed", start, end);
    }

    let Some(first) = markup.first() else { return };
    let parsed_markup = js_slice(source, first.position().start, node.markup_position.end);
    if has_skipped_characters(&Scan::new(parsed_markup)) {
        cx.report("Syntax error in 'when' tag", start, end);
    }
}

fn check_elsif_branch(node: &LiquidBranch, cx: &mut Context) {
    let (start, end) = (
        node.block_start_position.start,
        node.block_start_position.end,
    );
    let markup = match &node.markup {
        Markup::Node(markup) => markup,
        Markup::Str(_) => return cx.report("Syntax error in 'elsif' tag", start, end),
        _ => return,
    };
    let source = cx.source();

    if has_unclosed_quoted_string(&Scan::new(raw_markup(source, node.markup_position))) {
        return cx.report("Syntax error in 'elsif' tag", start, end);
    }

    if conditional_has_bare_array_access(markup) {
        return cx.report(ELSIF_BARE_ARRAY_ACCESS, start, end);
    }

    let markup_start = markup.position().start;
    if has_skipped_prefix_characters(source, node.markup_position.start, markup_start) {
        return cx.report("Syntax error in 'elsif' tag", start, end);
    }

    let parsed_markup = js_slice(source, markup_start, node.markup_position.end);
    if has_skipped_characters(&Scan::new(parsed_markup)) {
        cx.report("Syntax error in 'elsif' tag", start, end);
    }
}
