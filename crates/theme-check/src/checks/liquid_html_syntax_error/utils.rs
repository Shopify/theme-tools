//! `checks/liquid-html-syntax-error/checks/utils.ts`, plus the offset helpers the sub-checks
//! share. The patterns spell out JS `\s`, `\d` and `\w`, which are Unicode in Rust.

use regex::{Captures, Regex};
use std::sync::LazyLock;

pub const INVALID_SYNTAX_MESSAGE: &str = "Syntax is not supported";

/// The members of JS `\s`, for use inside a character class.
pub const WS: &str = r"\t\n\x0B\x0C\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}";

fn quoted_string() -> String {
    // `(DOUBLE_QUOTED_STRING|SINGLE_QUOTED_STRING)`
    r#"("[^"]*"|'[^']*')"#.to_string()
}

/// `RANGE_MARKUP_REGEX`. Lax parser does NOT complain about leading/trailing spaces inside
/// ranges (e.g. `(1 .. 10 )`) and within the parenthesis (e.g. `( 1 .. 10 )`), but fails to
/// render the liquid when using the gem. To avoid any issues, we will remove extra spaces.
fn range_markup() -> String {
    let component =
        format!(r"[{WS}]*(-?[0-9]+(?:\.[0-9]+)?|[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)[{WS}]*");
    format!(r"\([{WS}]*{component}(\.{{2,}})[{WS}]*{component}[{WS}]*\)")
}

/// `REGULAR_TOKEN`: tokens separated by commas or spaces.
fn regular_token() -> String {
    format!("[^{WS},]+")
}

/// `VALUE_PATTERN`: quoted, parenthesized, or regular token.
fn value_pattern() -> String {
    format!(
        "({}|{}|{})",
        quoted_string(),
        range_markup(),
        regular_token()
    )
}

fn key_value_pair() -> String {
    format!("([^{WS}]+):[{WS}]*{}", value_pattern())
}

static VALUE: LazyLock<Regex> = LazyLock::new(|| Regex::new(&value_pattern()).unwrap());
static RANGE: LazyLock<Regex> = LazyLock::new(|| Regex::new(&range_markup()).unwrap());
static KEY_VALUE_PAIR: LazyLock<Regex> = LazyLock::new(|| Regex::new(&key_value_pair()).unwrap());
static MARKUP_FRAGMENTS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        "{}|{}|{}|{}",
        quoted_string(),
        range_markup(),
        key_value_pair(),
        regular_token()
    ))
    .unwrap()
});

/// `getValuesInMarkup(markup)`: `(value, index)` pairs.
pub fn get_values_in_markup(markup: &str) -> impl Iterator<Item = (&str, usize)> {
    VALUE.find_iter(markup).map(|m| (m.as_str(), m.start()))
}

/// `getFragmentsInMarkup(markup)`: `(value, index)` pairs.
pub fn get_fragments_in_markup(markup: &str) -> Vec<(&str, usize)> {
    MARKUP_FRAGMENTS
        .find_iter(markup)
        .map(|m| (m.as_str(), m.start()))
        .collect()
}

/// `getRangeMatch(markup)`
pub fn get_range_match(markup: &str) -> Option<Captures<'_>> {
    RANGE.captures(markup)
}

/// `doesFragmentContainUnsupportedParentheses(fragment)`
pub fn does_fragment_contain_unsupported_parentheses(fragment: &str) -> bool {
    !RANGE.is_match(fragment) && fragment.contains(['(', ')'])
}

/// `fragmentKeyValuePair(fragment)`: the key (the value is never read).
pub fn fragment_key(fragment: &str) -> Option<&str> {
    KEY_VALUE_PAIR
        .captures(fragment)
        .map(|c| c.get(1).unwrap().as_str())
}

/// `source.indexOf(needle, from)`, `None` for -1.
// ponytail: TS reports at -1 + length when the markup isn't found from the node's start; the
// parser always leaves it there, so the sub-checks skip that case.
pub fn index_of(source: &str, needle: &str, from: usize) -> Option<usize> {
    source.get(from..)?.find(needle).map(|i| from + i)
}

/// The byte offset `units` UTF-16 code units after byte `from`: TS `index + string.length`
/// where the length comes from another string than the one at `index`. Past the end, one unit
/// per byte, like the runner.
// ponytail: a sum that lands inside a surrogate pair rounds up to the next char.
pub fn add16(source: &str, from: usize, units: usize) -> usize {
    let Some(rest) = source.get(from..) else {
        return from + units;
    };
    let mut n = 0;
    for (i, c) in rest.char_indices() {
        if n >= units {
            return from + i;
        }
        n += c.len_utf16();
    }
    source.len() + units.saturating_sub(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markup_patterns() {
        let values: Vec<_> = get_values_in_markup("a, 'b c' (1..2) d:e").collect();
        assert_eq!(
            values,
            vec![("a", 0), ("'b c'", 3), ("(1..2)", 9), ("d:e", 16)]
        );
        let fragments = get_fragments_in_markup("x in xs limit: 2 (1..3)");
        assert_eq!(
            fragments.iter().map(|f| f.0).collect::<Vec<_>>(),
            vec!["x", "in", "xs", "limit: 2", "(1..3)"]
        );
        assert_eq!(fragment_key("limit: 2"), Some("limit"));
        assert_eq!(fragment_key("a:b:c"), Some("a:b"));
        assert!(does_fragment_contain_unsupported_parentheses("(a"));
        assert!(!does_fragment_contain_unsupported_parentheses("( 1 .. 2 )"));
        let m = get_range_match("x in (1.5...a.b )").unwrap();
        assert_eq!(
            (&m[0], &m[1], &m[2], &m[3]),
            ("(1.5...a.b )", "1.5", "...", "a.b")
        );
        assert_eq!(add16("é\u{1F600}x", 0, 3), 6);
        assert_eq!(add16("ab", 1, 3), 4);
    }
}
