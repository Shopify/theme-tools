//! Port of `src/tags/liquid.ts`.
//!
//! Offsets are byte offsets into the source, so every TS `.length` that feeds
//! an offset is a byte length here.

use crate::errors::ParseError;
use crate::js::{js_is_whitespace, js_is_word};
use crate::markup::parser::MarkupParser;
use crate::tag_definitions::{LiquidLine, LiquidLineContext, Parser};
use crate::value::JsVal;

/// JS `s.trimStart()`.
fn trim_start(s: &str) -> &str {
    s.trim_start_matches(js_is_whitespace)
}

/// JS `s.trimEnd()`.
fn trim_end(s: &str) -> &str {
    s.trim_end_matches(js_is_whitespace)
}

/// JS `/^\w+\s*:/.test(s)`.
fn starts_with_named_argument(s: &str) -> bool {
    let after_word = s.trim_start_matches(js_is_word);
    after_word.len() < s.len() && trim_start(after_word).starts_with(':')
}

/// Checks if a trimmed line is a continuation of the previous line rather
/// than a new statement: the previous line ends with `,` and the current line
/// looks like a named argument (`identifier:`).
fn is_continuation_line(prev_trimmed: &str, current_trimmed: &str) -> bool {
    if !prev_trimmed.ends_with(',') {
        return false;
    }
    starts_with_named_argument(current_trimmed)
}

struct JoinedLine {
    raw: String,
    start_index: usize,
}

/// First pass: join continuation lines into one logical line.
fn join_lines(body: &str, body_start: usize) -> Vec<JoinedLine> {
    let mut joined: Vec<JoinedLine> = Vec::new();
    let mut offset = 0;
    for raw_line in body.split('\n') {
        let line_start = body_start + offset;
        let trimmed = trim_start(raw_line);
        offset += raw_line.len() + 1;

        let previous = joined.last_mut().filter(|prev| {
            !trimmed.is_empty() && is_continuation_line(trim_end(&prev.raw), trimmed)
        });
        if let Some(prev) = previous {
            // Append to previous logical line (preserve raw text for offset calc)
            prev.raw.push('\n');
            prev.raw.push_str(raw_line);
            continue;
        }

        joined.push(JoinedLine {
            raw: raw_line.to_string(),
            start_index: line_start,
        });
    }
    joined
}

/// Second pass: parse one logical line, or `None` for a blank line.
fn parse_line(raw: &str, start_index: usize) -> Option<LiquidLine> {
    let trimmed = trim_start(raw);
    let leading_ws = raw.len() - trimmed.len();

    let line_end = match raw.rfind('\n') {
        None => start_index + trim_end(raw).len(),
        Some(last_newline) => {
            let last_raw_line = &raw[last_newline + 1..];
            start_index + last_newline + 1 + trim_end(last_raw_line).len()
        }
    };

    if trimmed.is_empty() {
        return None;
    }

    // For tag name extraction, use only the first line's content.
    let first_line_trimmed = trimmed.split('\n').next().unwrap_or(trimmed);
    let name_offset = start_index + leading_ws;

    if first_line_trimmed.starts_with('#') {
        // Strip at most one separator whitespace after `#`, mirroring the
        // pre-swap ohm grammar `"#" space?`.
        let after_hash = &trimmed[1..];
        let markup = after_hash.strip_prefix([' ', '\t']).unwrap_or(after_hash);
        let markup_offset = start_index + leading_ws + 1 + (trimmed.len() - 1 - markup.len());
        return Some(LiquidLine {
            tag_name: "#".to_string(),
            markup: markup.to_string(),
            markup_offset,
            name_offset,
            line_end,
        });
    }

    let Some(first_ws) = first_line_trimmed.find(js_is_whitespace) else {
        return Some(LiquidLine {
            tag_name: first_line_trimmed.to_string(),
            markup: String::new(),
            markup_offset: start_index + leading_ws + first_line_trimmed.len(),
            name_offset,
            line_end,
        });
    };

    let rest = &trimmed[first_ws..];
    let markup = trim_start(rest);
    Some(LiquidLine {
        tag_name: first_line_trimmed[..first_ws].to_string(),
        markup: markup.to_string(),
        markup_offset: start_index + leading_ws + first_ws + (rest.len() - markup.len()),
        name_offset,
        line_end,
    })
}

fn parse_lines(body: &str, body_start: usize) -> Vec<LiquidLine> {
    join_lines(body, body_start)
        .iter()
        .filter_map(|line| parse_line(&line.raw, line.start_index))
        .collect()
}

pub fn parse(
    _name: &str,
    markup_parser: &mut MarkupParser<'_>,
    parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    let context = markup_parser.body_context();
    let body = &context.source[context.body_start..context.body_end];
    let lines = parse_lines(body, context.body_start);
    let mut ctx = LiquidLineContext { lines, index: 0 };
    let mut statements = Vec::new();

    while ctx.index < ctx.lines.len() {
        let line = &ctx.lines[ctx.index];
        let tag_name = line.tag_name.clone();
        let markup = line.markup.clone();
        let markup_offset = line.markup_offset;
        ctx.index += 1;
        statements.push(parser.parse_liquid_statement(
            &tag_name,
            &markup,
            markup_offset,
            &mut ctx,
        )?);
    }

    Ok(JsVal::array(statements))
}
