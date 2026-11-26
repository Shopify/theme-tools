//! `checks/InvalidLoopArguments.ts`

use super::utils::{
    does_fragment_contain_unsupported_parentheses, fragment_key, get_fragments_in_markup, index_of,
};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::checks::utils::is_loop_tag_name;
use crate::docset::ThemeDocset;
use crate::fixes::Fix;
use liquid_ast::{ForMarkup, LiquidTag, Markup, Node};

pub fn detect_invalid_loop_arguments(
    node: &LiquidTag,
    source: &str,
    tags: Option<&ThemeDocset>,
) -> Option<Problem> {
    if !is_loop_tag_name(&node.name) {
        return None;
    }

    let (markup_index, fragments) = match &node.markup {
        Markup::Str(markup) if !markup.is_empty() => {
            let markup_index = index_of(source, markup, node.span.start)?;
            // The first three fragments are: `<variable> in <array>`
            let fragments = get_fragments_in_markup(markup)
                .into_iter()
                .skip(3)
                .map(|(value, index)| ArgumentFragment {
                    value,
                    index,
                    key: None,
                })
                .collect();
            (markup_index, fragments)
        }
        Markup::Node(n) => match n.as_ref() {
            Node::ForMarkup(markup) => {
                (markup.span.start, parsed_argument_fragments(markup, source))
            }
            _ => return None,
        },
        _ => return None,
    };

    // If they haven't started typing the arguments, we don't want to report an error.
    let (first, last) = (fragments.first()?, fragments.last()?);
    let start = markup_index + first.index;
    let end = markup_index + last.index + last.value.len();

    // Positional arguments are ignored if they come after invalid positional args or named args
    let mut no_more_positional_arguments = false;
    let mut invalid_fragments = Vec::new();
    let mut filtered_fragments = Vec::new();

    for fragment in &fragments {
        let (fragment, key) = (fragment.value, fragment.key);

        // The parser already accepted the value of a named argument it found
        if key.is_none() && does_fragment_contain_unsupported_parentheses(fragment) {
            no_more_positional_arguments = true;
            invalid_fragments.push(fragment);
            continue;
        }

        // Named arg is found
        if let Some(key) = key.or_else(|| fragment_key(fragment)) {
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

/// An argument of a loop tag, at an offset relative to the markup. `key` is set for a named
/// argument the parser found.
struct ArgumentFragment<'a> {
    value: &'a str,
    index: usize,
    key: Option<&'a str>,
}

/// The fragments of a parsed loop's markup after `<variable> in <array>`.
///
/// The parser already found the collection and the named arguments. Their values can be lookups
/// such as `settings['item count']`, which the fragment pattern would split at the space. So only
/// the text around them, such as `reversed` or anything the parser skipped, goes through the
/// pattern.
fn parsed_argument_fragments<'a>(
    markup: &'a ForMarkup,
    source: &'a str,
) -> Vec<ArgumentFragment<'a>> {
    let offset = markup.span.start;
    let mut fragments = Vec::new();
    let mut text_start = markup.collection.span().end;

    let add_text_until =
        |fragments: &mut Vec<ArgumentFragment<'a>>, text_start: usize, text_end: usize| {
            for (value, index) in get_fragments_in_markup(&source[text_start..text_end]) {
                fragments.push(ArgumentFragment {
                    value,
                    index: text_start - offset + index,
                    key: None,
                });
            }
        };

    for arg in &markup.args {
        add_text_until(&mut fragments, text_start, arg.span.start);
        fragments.push(ArgumentFragment {
            value: &source[arg.span.start..arg.span.end],
            index: arg.span.start - offset,
            key: Some(&arg.name),
        });
        text_start = arg.span.end;
    }
    add_text_until(&mut fragments, text_start, markup.span.end);

    fragments
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
