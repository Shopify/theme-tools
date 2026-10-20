//! `checks/InvalidLoopRange.ts`

use super::utils::{get_range_match, index_of};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::checks::utils::is_loop_tag_name;
use crate::fixes::Fix;
use liquid_ast::{LiquidTag, Markup, Node};

pub const INVALID_LOOP_RANGE_MESSAGE: &str = "Ranges must be in the format `(<start>..<end>)`. The start and end of the range must be whole numbers or variables.";

pub fn detect_invalid_loop_range(node: &LiquidTag, source: &str) -> Option<Problem> {
    if !is_loop_tag_name(&node.name) {
        return None;
    }
    match &node.markup {
        Markup::Str(markup) if !markup.is_empty() => validate_markup(node, markup, source),
        Markup::Node(n) => match n.as_ref() {
            Node::ForMarkup(m) if matches!(m.collection.as_ref(), Node::Range(_)) => {
                let p = m.collection.position();
                validate_markup(node, &source[p.start..p.end], source)
            }
            _ => None,
        },
        _ => None,
    }
}

fn validate_markup(node: &LiquidTag, markup: &str, source: &str) -> Option<Problem> {
    let m = get_range_match(markup)?;
    let full_match = m.get(0).unwrap();
    let expected_range_markup = format!("({}..{})", cleaned(&m[1]), cleaned(&m[3]));
    if full_match.as_str() == expected_range_markup {
        return None;
    }

    let start = index_of(source, markup, node.position.start)? + full_match.start();
    let end = start + full_match.len();
    Some(Problem {
        message: INVALID_LOOP_RANGE_MESSAGE.into(),
        start,
        end,
        fix: Some(Fix::replace(start, end, expected_range_markup)),
    })
}

/// `!isNaN(Number(s)) && Number(s) % 1 !== 0 ? \`${Math.trunc(Number(s))}\` : s`
fn cleaned(s: &str) -> String {
    match js_number(s) {
        Some(n) if n.is_infinite() => "Infinity".to_string(), // `Infinity % 1` is NaN
        Some(n) if n.fract() != 0.0 => match n.trunc() {
            0.0 => "0".to_string(), // `${-0}`
            t => t.to_string(), // A fractional double is below 2^53, where JS prints it the same.
        },
        _ => s.to_string(),
    }
}

/// `Number(s)` for a range component (`-?\d+(\.\d+)?` or `\w+(\.\w+)*`), when it could be
/// fractional. Hex/octal/binary literals and `Infinity` are whole, so they're `None` here too.
fn js_number(s: &str) -> Option<f64> {
    let decimal = s
        .bytes()
        .all(|b| b.is_ascii_digit() || matches!(b, b'.' | b'e' | b'E' | b'+' | b'-'));
    if !decimal || !s.bytes().any(|b| b.is_ascii_digit()) {
        return None;
    }
    s.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::cleaned;

    #[test]
    fn numbers() {
        assert_eq!(cleaned("1.5"), "1");
        assert_eq!(cleaned("-0.5"), "0");
        assert_eq!(cleaned("-2.5"), "-2");
        assert_eq!(cleaned("1.25e1"), "12");
        assert_eq!(cleaned("1.5e1"), "1.5e1");
        assert_eq!(cleaned("a.b"), "a.b");
        assert_eq!(cleaned("10"), "10");
        assert_eq!(cleaned("1e400"), "Infinity");
    }
}
