//! `checks/InvalidLoopArguments.ts`

use super::utils::{
    does_fragment_contain_unsupported_parentheses, fragment_key, get_fragments_in_markup, index_of,
};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::checks::utils::is_loop_tag_name;
use crate::docset::ThemeDocset;
use crate::fixes::Fix;
use liquid_ast::{LiquidTag, Markup, Node};

pub fn detect_invalid_loop_arguments(
    node: &LiquidTag,
    source: &str,
    tags: Option<&ThemeDocset>,
) -> Option<Problem> {
    if !is_loop_tag_name(&node.name) {
        return None;
    }

    let markup = match &node.markup {
        Markup::Str(markup) if !markup.is_empty() => markup,
        Markup::Node(n) if matches!(n.as_ref(), Node::ForMarkup(_)) => {
            let p = n.position();
            &source[p.start..p.end]
        }
        _ => return None,
    };

    let fragments = get_fragments_in_markup(markup);

    // The first three fragments are: `<variable> in <array>`
    // If they haven't started typing the tag, we don't want to report an error.
    if fragments.len() <= 3 {
        return None;
    }

    let markup_index = index_of(source, markup, node.position.start)?;
    let start = markup_index + fragments[3].1;
    let last = fragments.last().unwrap();
    let end = markup_index + last.1 + last.0.len();

    // Positional arguments are ignored if they come after invalid positional args or named args
    let mut no_more_positional_arguments = false;
    let mut invalid_fragments = Vec::new();
    let mut filtered_fragments = Vec::new();

    for &(fragment, _) in &fragments[3..] {
        if does_fragment_contain_unsupported_parentheses(fragment) {
            no_more_positional_arguments = true;
            invalid_fragments.push(fragment);
            continue;
        }

        // Named arg is found
        if let Some(key) = fragment_key(fragment) {
            no_more_positional_arguments = true;
            if !is_supported_tag_argument(tags, &node.name, key, false) {
                invalid_fragments.push(fragment);
                continue;
            }
        }
        // Unsupported positional arg is found
        else if no_more_positional_arguments
            || !is_supported_tag_argument(tags, &node.name, fragment, true)
        {
            no_more_positional_arguments = true;
            invalid_fragments.push(fragment);
            continue;
        }

        filtered_fragments.push(fragment);
    }

    if invalid_fragments.is_empty() {
        return None;
    }

    Some(Problem {
        message: format!(
            "Arguments must be provided in the format `{} in <array> <positional arguments> <named arguments>`. Invalid/Unknown arguments: {}",
            node.name,
            invalid_fragments.join(", ")
        )
        .into(),
        start,
        end,
        fix: Some(Fix::replace(start, end, filtered_fragments.join(" "))),
    })
}

fn is_supported_tag_argument(
    tags: Option<&ThemeDocset>,
    tag_name: &str,
    key: &str,
    positional: bool,
) -> bool {
    tags.and_then(|t| t.tag(tag_name))
        .and_then(|tag| tag["parameters"].as_array())
        .is_some_and(|parameters| {
            parameters
                .iter()
                .any(|p| p["name"] == key && p["positional"].as_bool() == Some(positional))
        })
}
