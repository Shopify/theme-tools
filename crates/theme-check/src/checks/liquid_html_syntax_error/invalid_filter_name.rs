//! `checks/InvalidFilterName.ts`

use super::utils::{add16, index_of, INVALID_SYNTAX_MESSAGE, WS};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::docset::ThemeDocset;
use crate::fixes::Fix;
use crate::js;
use liquid_ast::{LiquidVariable, Markup, Node, Position};
use regex::Regex;
use std::sync::LazyLock;

static FILTER_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\|[{WS}]*([a-zA-Z][a-zA-Z0-9_]*)")).unwrap());

/// `detectInvalidFilterName(node, filters)` for a LiquidVariableOutput (`tag_name` is `None`)
/// or a LiquidTag.
pub fn detect_invalid_filter_name(
    tag_name: Option<&str>,
    markup: &Markup,
    position: Position,
    source: &str,
    filters: Option<&ThemeDocset>,
    problems: &mut Vec<Problem>,
) {
    let Some(docset) = filters else { return };
    let variable = match (tag_name, markup) {
        (None | Some("echo" | "assign"), Markup::Str(markup)) => {
            return detect_invalid_filter_name_in_markup(
                markup, position, source, docset, problems,
            );
        }
        (None | Some("echo"), Markup::Node(n)) => match n.as_ref() {
            Node::LiquidVariable(v) => v,
            _ => return,
        },
        (Some("assign"), Markup::Node(n)) => match n.as_ref() {
            Node::AssignMarkup(m) => &m.value,
            _ => return,
        },
        _ => return,
    };
    detect_invalid_filter_name_in_filters(variable, source, docset, problems);
}

/// When the tokenizer meets an invalid trailing character (`@`, `!`, `#`, ...) it silently
/// drops the byte, so the filter parses cleanly and the markup ends up as a structured
/// `LiquidVariable`. The dropped byte still lives in the document `source` right after the
/// filter name, so we recover the offense from the source span instead.
fn detect_invalid_filter_name_in_filters(
    variable: &LiquidVariable,
    source: &str,
    docset: &ThemeDocset,
    problems: &mut Vec<Problem>,
) {
    let markup_end = variable.position.end;
    for filter in &variable.filters {
        if docset.filter(&filter.name).is_none() {
            continue;
        }

        // `filter.position.start` sits before this filter's pipe, so the first occurrence of
        // the name from there is this filter's name.
        let Some(name_start) = index_of(source, &filter.name, filter.position.start) else {
            continue;
        };
        let trailing_start = name_start + filter.name.len();

        // `/^([^\s:|]+)/`: the run wedged between the filter name and its next valid boundary.
        let after = source
            .get(trailing_start..markup_end.max(trailing_start))
            .unwrap_or("");
        let trailing_len = after
            .find(|c: char| js::is_space(c) || c == ':' || c == '|')
            .unwrap_or(after.len());
        if trailing_len == 0 {
            continue;
        }
        let trailing = &after[..trailing_len];

        problems.push(Problem {
            message: format!(
                "{INVALID_SYNTAX_MESSAGE} Filter '{}' has trailing characters '{trailing}' that should be removed.",
                filter.name
            )
            .into(),
            start: trailing_start,
            end: trailing_start + trailing_len,
            fix: Some(Fix::remove(trailing_start, trailing_start + trailing_len)),
        });
    }
}

fn detect_invalid_filter_name_in_markup(
    markup: &str,
    position: Position,
    source: &str,
    docset: &ThemeDocset,
    problems: &mut Vec<Problem>,
) {
    let trimmed = js::trim(markup);
    for m in FILTER_PATTERN.captures_iter(trimmed) {
        let filter_name = m.get(1).unwrap().as_str();
        if docset.filter(filter_name).is_none() {
            continue;
        }

        let filter_end = m.get(0).unwrap().end();
        let Some(invalid_segment) = invalid_segment(&trimmed[filter_end..]) else {
            continue;
        };

        // TS adds the offset in the trimmed markup to where the untrimmed markup starts.
        let Some(markup_start) = index_of(source, markup, position.start) else {
            continue;
        };
        let start = add16(source, markup_start, js::len16(&trimmed[..filter_end]));
        let end = add16(source, start, js::len16(invalid_segment));

        problems.push(Problem {
            message: format!(
                "{INVALID_SYNTAX_MESSAGE} Filter '{filter_name}' has trailing characters '{invalid_segment}' that should be removed."
            )
            .into(),
            start,
            end,
            fix: Some(Fix::remove(start, end)),
        });
    }
}

/// `afterFilter.match(/^(?!\s*(?::|$|\|\s*[a-zA-Z]|\|\s*\||\s*\|\s*(?:[}%]|$)))([^:|]+?)(?=\s*(?::|$|\|))/)?.[1]`:
/// skip valid syntax like `: parameter` or `| nextfilter`, else capture the junk up to the
/// whitespace before the next `:`, `|` or the end.
fn invalid_segment(after_filter: &str) -> Option<&str> {
    let rest = js::trim_start(after_filter);
    if rest.is_empty() || rest.starts_with(':') {
        return None;
    }
    if let Some(next) = rest.strip_prefix('|') {
        let next = js::trim_start(next);
        if next.is_empty()
            || next.starts_with(|c: char| c.is_ascii_alphabetic() || matches!(c, '|' | '}' | '%'))
        {
            return None;
        }
    }

    let boundary = after_filter.find([':', '|']).unwrap_or(after_filter.len());
    if boundary == 0 {
        return None;
    }
    // The lazy group stops where only whitespace is left before the boundary, after one char.
    let junk_end = js::trim_end(&after_filter[..boundary]).len();
    let first_char = after_filter.chars().next().unwrap().len_utf8();
    Some(&after_filter[..junk_end.max(first_char)])
}

#[cfg(test)]
mod tests {
    use super::invalid_segment;

    #[test]
    fn segments() {
        assert_eq!(invalid_segment(" xyz"), Some(" xyz"));
        assert_eq!(invalid_segment("@ : 1"), Some("@"));
        assert_eq!(invalid_segment(" | downcase"), None);
        assert_eq!(invalid_segment(": 1"), None);
        assert_eq!(invalid_segment(""), None);
        assert_eq!(invalid_segment(" | }"), None);
        assert_eq!(invalid_segment("  | 1"), Some(" "));
        assert_eq!(invalid_segment("| 1"), None);
    }
}
