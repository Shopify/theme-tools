//! `checks/liquid-syntax-error/base.ts`

use crate::context::Context;
use liquid_ast::{LiquidTag, Markup, Node};
use liquid_parser::BUILTIN_TAGS;
use std::collections::HashSet;

pub fn check_base_tag(node: &LiquidTag, cx: &mut Context, reported: &mut HashSet<usize>) {
    if let Some(reason) = &node.reason {
        cx.report(reason.to_string(), node.position.start, node.position.end);
        return;
    }

    if let ("liquid", Markup::Nodes(statements)) = (&*node.name, &node.markup) {
        check_unknown_tags_inside_liquid_block(statements, cx, reported);
        return;
    }

    if reported.contains(&addr(node)) {
        return;
    }
    if is_unknown_tag_inside_liquid_block(node, cx) {
        reported.insert(addr(node));
        cx.report(
            format!("Unknown tag '{}'", node.name),
            node.position.start,
            node.position.end,
        );
    }
}

fn check_unknown_tags_inside_liquid_block(
    statements: &[Node],
    cx: &mut Context,
    reported: &mut HashSet<usize>,
) {
    for statement in statements {
        let Node::LiquidTag(statement) = statement else {
            continue;
        };
        if !reported.contains(&addr(statement)) && is_unknown_tag_inside_liquid_block(statement, cx)
        {
            reported.insert(addr(statement));
            cx.report(
                format!("Unknown tag '{}'", statement.name),
                statement.position.start,
                statement.position.end,
            );
        }
    }
}

/// `knownLiquidTagsFor(context).has(name)`
fn is_known_liquid_tag(name: &str, cx: &Context) -> bool {
    matches!(name, "#" | "else" | "elsif" | "when")
        || match cx.docset() {
            Some(docset) => docset.tag(name).is_some(),
            None => BUILTIN_TAGS.contains(&name),
        }
}

fn is_unknown_tag_inside_liquid_block(node: &LiquidTag, cx: &Context) -> bool {
    // Statements inside `{% liquid %}` do not have their own `{%` delimiter.
    if cx.source()[node.position.start..].starts_with("{%") {
        return false;
    }
    !is_known_liquid_tag(&node.name, cx)
}

fn addr(node: &LiquidTag) -> usize {
    node as *const LiquidTag as usize
}
