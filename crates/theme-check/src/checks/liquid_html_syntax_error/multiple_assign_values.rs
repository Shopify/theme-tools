//! `checks/MultipleAssignValues.ts`

use super::utils::{add16, get_values_in_markup, index_of, INVALID_SYNTAX_MESSAGE};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::fixes::Fix;
use crate::js;
use liquid_ast::LiquidTag;

pub fn detect_multiple_assign_values(node: &LiquidTag, source: &str) -> Option<Problem> {
    if node.name != "assign" {
        return None;
    }
    let markup = node.markup.as_str()?;

    // If we have a markup 'foo    =    "123" something | upcase: 123', we have
    // 'foo    ', '=    ' and '"123" something'.
    let (assignment_variable, assignment_operator, assignment_value) = assign_markup_match(markup)?;
    let (first_assignment_value, _) = get_values_in_markup(assignment_value).next()?;

    // TS adds the group lengths to the markup's offset, wherever the match started.
    let offset = index_of(source, markup, node.position.start)?;
    let lhs = js::len16(assignment_variable) + js::len16(assignment_operator);
    let start = add16(source, offset, lhs + js::len16(first_assignment_value));
    let end = add16(
        source,
        offset,
        lhs + js::len16(js::trim_end(assignment_value)),
    );
    (end > start).then(|| Problem {
        message: INVALID_SYNTAX_MESSAGE.into(),
        start,
        end,
        fix: Some(Fix::remove(start, end)),
    })
}

/// `markup.match(/([^=]+)(=\s*)([^|]+)(?:\s*\|\s*.*)?$/m)`, using the regex from Shopify/liquid's
/// assign tag: groups 1 to 3 (the variable, the operator, the value up to the first `|`). The
/// optional filter group then `$` always match once the value group has, so the match only
/// depends on the first three groups.
fn assign_markup_match(s: &str) -> Option<(&str, &str, &str)> {
    let value_end = |from: usize| s[from..].find('|').map_or(s.len(), |i| from + i);
    let mut start = 0;
    loop {
        // `[^=]+` stops at the first `=`, so every start before it fails the same way.
        let eq = start + s[start..].find('=')?;
        if eq > start {
            let ws_end = s.len() - js::trim_start(&s[eq + 1..]).len();
            if ws_end < s.len() && s.as_bytes()[ws_end] != b'|' {
                return Some((&s[start..eq], &s[eq..ws_end], &s[ws_end..value_end(ws_end)]));
            }
            // `[^|]+` needs one char: `\s*` gives back its last whitespace.
            if ws_end > eq + 1 {
                let last_ws = s[..ws_end].char_indices().next_back().unwrap().0;
                return Some((&s[start..eq], &s[eq..last_ws], &s[last_ws..ws_end]));
            }
        }
        start = eq + 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assign_regex() {
        assert_eq!(
            assign_markup_match("foo  =  \"1\" x | up"),
            Some(("foo  ", "=  ", "\"1\" x "))
        );
        assert_eq!(assign_markup_match("foo = | up"), Some(("foo ", "=", " ")));
        assert_eq!(assign_markup_match("=x"), None);
        assert_eq!(assign_markup_match("a =|b = c"), Some(("|b ", "= ", "c")));
        assert_eq!(assign_markup_match("a"), None);
    }
}
