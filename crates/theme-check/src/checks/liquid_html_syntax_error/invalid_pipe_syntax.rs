//! `checks/InvalidPipeSyntax.ts`

use super::utils::{add16, index_of, INVALID_SYNTAX_MESSAGE, WS};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::fixes::Fix;
use crate::js;
use liquid_ast::{Markup, Position};
use regex::Regex;
use std::sync::LazyLock;

static EXTRA_PIPES: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"(?:\|[{WS}]*){{2,}}")).unwrap());
static TRAILING_PIPE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"(?:[{WS}]*\|)+[{WS}]*$")).unwrap());

/// `detectInvalidPipeSyntax(node)` for a LiquidVariableOutput (`tag_name` is `None`) or a
/// LiquidTag.
pub fn detect_invalid_pipe_syntax(
    tag_name: Option<&str>,
    markup: &Markup,
    position: Position,
    source: &str,
    problems: &mut Vec<Problem>,
) {
    if let (None | Some("echo" | "assign"), Markup::Str(markup)) = (tag_name, markup) {
        detect_pipe_syntax_in_markup(markup, position, source, problems);
    }
}

fn detect_pipe_syntax_in_markup(
    markup: &str,
    position: Position,
    source: &str,
    problems: &mut Vec<Problem>,
) {
    let trimmed = js::trim(markup);
    // TS adds offsets in the trimmed markup to where the untrimmed markup starts.
    let span = |s: usize, e: usize| {
        let markup_start = index_of(source, markup, position.start)?;
        let start = add16(source, markup_start, js::len16(&trimmed[..s]));
        Some((start, add16(source, start, js::len16(&trimmed[s..e]))))
    };

    // Check for multiple consecutive pipes
    for m in EXTRA_PIPES.find_iter(trimmed) {
        // Pipes that end the markup are a trailing pipe, reported below.
        if m.end() == trimmed.len() {
            continue;
        }
        let Some((start, end)) = span(m.start(), m.end()) else {
            continue;
        };
        problems.push(Problem {
            message: format!("{INVALID_SYNTAX_MESSAGE}. Remove extra `|` character(s).").into(),
            start,
            end,
            fix: Some(Fix::replace(start, end, "| ")),
        });
    }

    // Check for trailing pipes
    if let Some(m) = TRAILING_PIPE.find(trimmed) {
        let Some((start, end)) = span(m.start(), m.end()) else {
            return;
        };
        problems.push(Problem {
            message: format!("{INVALID_SYNTAX_MESSAGE}. Remove the trailing `|` character.").into(),
            start,
            end,
            fix: Some(Fix::remove(start, end)),
        });
    }
}
