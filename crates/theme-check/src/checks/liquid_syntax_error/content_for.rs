//! `checks/liquid-syntax-error/content-for.ts`

use super::utils::*;
use crate::context::Context;
use liquid_ast::{ContentForMarkup, LiquidTag, Markup, Node};

const ACCEPTED_CONTENT_FOR_TYPES: &[&str] = &["block", "blocks"];
const RESERVED_BLOCK_ATTRIBUTES: &[&str] = &["block", "schema"];
const CONTENT_FOR_CLOSEST_PREFIX: &str = "closest.";
const CONTENT_FOR_METAOBJECT_CLOSEST_PREFIX: &str = "metaobject.";
const CONTENT_FOR_CLOSEST_RESOURCE_TYPES: &[&str] =
    &["article", "blog", "collection", "page", "product"];

pub fn check_content_for_tag(node: &LiquidTag, cx: &mut Context) {
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::ContentForMarkup(m) => m,
            _ => return,
        },
        Markup::Str(_) => return report(node, cx),
        _ => return,
    };
    let content_for_type = &*markup.content_for_type.value;

    // Parseable but unsupported values
    if !ACCEPTED_CONTENT_FOR_TYPES.contains(&content_for_type) {
        return cx.report(
            format!(
                "Invalid content_for type \"{content_for_type}\"; expected \"block\" or \"blocks\""
            ),
            node.position.start,
            node.position.end,
        );
    }

    if has_invalid_shared_arguments(markup)
        || (content_for_type == "block" && has_invalid_block_arguments(markup))
        || (content_for_type == "blocks" && has_invalid_blocks_arguments(markup))
    {
        report(node, cx);
    }
}

fn has_invalid_shared_arguments(markup: &ContentForMarkup) -> bool {
    has_duplicate_arguments(markup) || markup.args.iter().any(|a| has_bare_array_access(&a.value))
}

fn has_duplicate_arguments(markup: &ContentForMarkup) -> bool {
    let args = &markup.args;
    (1..args.len()).any(|i| args[..i].iter().any(|seen| seen.name == args[i].name))
}

fn has_invalid_block_arguments(markup: &ContentForMarkup) -> bool {
    markup
        .args
        .iter()
        .any(|a| RESERVED_BLOCK_ATTRIBUTES.contains(&&*a.name))
        || has_invalid_block_static_arguments(markup)
        || has_invalid_closest_arguments(markup, false)
}

fn has_invalid_block_static_arguments(markup: &ContentForMarkup) -> bool {
    let non_empty_string_arg = |name: &str| {
        markup
            .args
            .iter()
            .find(|a| a.name == name)
            .is_some_and(|a| matches!(a.value.as_ref(), Node::String(s) if !s.value.is_empty()))
    };
    !(non_empty_string_arg("type") && non_empty_string_arg("id"))
}

fn has_invalid_blocks_arguments(markup: &ContentForMarkup) -> bool {
    has_invalid_closest_arguments(markup, true)
}

/// `hasInvalidBlocksArguments` (`only_closest`) and `hasInvalidBlockClosestArguments`.
fn has_invalid_closest_arguments(markup: &ContentForMarkup, only_closest: bool) -> bool {
    let mut context_argument_count = 0;
    for arg in &markup.args {
        let Some(closest_type) = arg.name.strip_prefix(CONTENT_FOR_CLOSEST_PREFIX) else {
            if only_closest {
                return true;
            }
            continue;
        };
        if matches!(arg.value.as_ref(), Node::String(_)) {
            return true;
        }
        context_argument_count += 1;
        if context_argument_count > 1 {
            return true;
        }
        if !is_supported_closest_type(closest_type) {
            return true;
        }
    }
    false
}

fn is_supported_closest_type(closest_type: &str) -> bool {
    CONTENT_FOR_CLOSEST_RESOURCE_TYPES.contains(&closest_type)
        || closest_type.starts_with(CONTENT_FOR_METAOBJECT_CLOSEST_PREFIX)
}

fn report(node: &LiquidTag, cx: &mut Context) {
    cx.report(
        "Syntax error in 'content_for' tag",
        node.position.start,
        node.position.end,
    );
}
