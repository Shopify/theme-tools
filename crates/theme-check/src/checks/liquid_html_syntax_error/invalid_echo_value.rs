//! `checks/InvalidEchoValue.ts`

use super::utils::{add16, get_values_in_markup, index_of, INVALID_SYNTAX_MESSAGE};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::fixes::Fix;
use crate::js;
use liquid_ast::{Markup, Position};

/// `detectInvalidEchoValue(node)` for an `echo` LiquidTag or a LiquidVariableOutput.
pub fn detect_invalid_echo_value(
    markup: &Markup,
    position: Position,
    source: &str,
) -> Option<Problem> {
    // echo tags and variable outputs without markup are strict-valid: e.g. {{ }}, {% echo %},
    // and {% liquid echo %}
    let Markup::Str(markup) = markup else {
        return None;
    };
    if markup.is_empty() {
        return None;
    }

    // `ECHO_MARKUP_REGEX` (`/([^|]*)(?:\s*\|\s*.*)?$/m`) always matches at 0: its first group
    // runs to the first `|`.
    let echo_value = &markup[..markup.find('|').unwrap_or(markup.len())];
    let offset = index_of(source, markup, position.start)?;

    let Some((first_echo_value, _)) = get_values_in_markup(echo_value).next() else {
        let end = offset + markup.len();
        return Some(Problem {
            message: INVALID_SYNTAX_MESSAGE.into(),
            start: offset,
            end,
            fix: Some(Fix::replace(offset, end, "blank")),
        });
    };

    let start = add16(source, offset, js::len16(first_echo_value));
    let end = add16(source, offset, js::len16(js::trim_end(echo_value)));
    (end > start).then(|| Problem {
        message: INVALID_SYNTAX_MESSAGE.into(),
        start,
        end,
        fix: Some(Fix::remove(start, end)),
    })
}
