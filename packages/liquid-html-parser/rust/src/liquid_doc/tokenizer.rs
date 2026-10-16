//! Port of `src/liquid-doc/tokenizer.ts`.
//!
//! Token offsets are byte offsets into the source and values are slices of
//! the body. Callers convert offsets to UTF-16 when they are emitted to JS.
//!
//! The TS regexes have no `u` flag. Each one is ported as a hand-written
//! matcher with the regex quoted in its doc comment. Every one of them starts
//! with an ASCII character, so a byte position here is a UTF-16 position in
//! TS.

use crate::js::js_is_word;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LiquidDocTokenType {
    Annotation,
    TextLine,
    Newline,
    EndOfInput,
}

impl LiquidDocTokenType {
    pub fn as_str(self) -> &'static str {
        match self {
            LiquidDocTokenType::Annotation => "Annotation",
            LiquidDocTokenType::TextLine => "TextLine",
            LiquidDocTokenType::Newline => "Newline",
            LiquidDocTokenType::EndOfInput => "EndOfInput",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct LiquidDocToken<'a> {
    pub kind: LiquidDocTokenType,
    pub value: &'a str,
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ParamTokenType {
    Type,
    OptionalName,
    Word,
    Dash,
    Text,
    EndOfInput,
}

#[derive(Clone, Copy, Debug)]
pub struct ParamToken<'a> {
    pub kind: ParamTokenType,
    pub value: &'a str,
    pub start: usize,
    pub end: usize,
}

/// JS `/./` without the `s` or `u` flag matches any unit except these.
fn is_line_terminator(c: char) -> bool {
    matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// TS `NEWLINE_RE`, `/\r?\n/y`, at `pos`. Returns the match end.
fn newline_end(body: &str, pos: usize) -> Option<usize> {
    let rest = &body.as_bytes()[pos..];
    if rest.starts_with(b"\r\n") {
        return Some(pos + 2);
    }
    rest.starts_with(b"\n").then_some(pos + 1)
}

/// TS `WHITESPACE_RE` and `PARAM_WHITESPACE_RE`, `/[ \t]+/y`, at `pos`.
/// Returns the match end.
fn blank_end(text: &str, pos: usize) -> Option<usize> {
    let rest = &text[pos..];
    let run = rest.len() - rest.trim_start_matches([' ', '\t']).len();
    (run > 0).then_some(pos + run)
}

/// The end of a run of JS `\w` characters starting at `pos`.
fn word_run_end(text: &str, pos: usize) -> usize {
    let rest = &text[pos..];
    pos + rest.len() - rest.trim_start_matches(js_is_word).len()
}

/// TS `ANNOTATION_RE`, `/@(\w+)/y`, at `pos`. Returns the match end.
fn annotation_end(body: &str, pos: usize) -> Option<usize> {
    if !body[pos..].starts_with('@') {
        return None;
    }
    let end = word_run_end(body, pos + 1);
    (end > pos + 1).then_some(end)
}

/// TS `MIDLINE_ANNOTATION_RE`, `/.@\w+/g`, run from index 0 of `line`.
/// Returns the index of the `@`, which is TS `midMatch.index + 1`.
fn midline_annotation_at(line: &str) -> Option<usize> {
    line.match_indices('@').map(|(at, _)| at).find(|&at| {
        let before = line[..at].chars().next_back();
        let starts_word = line[at + 1..].chars().next().is_some_and(js_is_word);
        before.is_some_and(|c| !is_line_terminator(c)) && starts_word
    })
}

/// TS `OPTIONAL_NAME_RE`, `/\[([^\]]*)\]/y`, at `pos`. Returns the match end.
fn optional_name_end(text: &str, pos: usize) -> Option<usize> {
    if !text[pos..].starts_with('[') {
        return None;
    }
    text[pos + 1..].find(']').map(|close| pos + 1 + close + 1)
}

/// TS `WORD_RE`, `/[\w][\w-]*/y`, at `pos`. Returns the match end.
fn word_end(text: &str, pos: usize) -> Option<usize> {
    let first = text[pos..].chars().next()?;
    if !js_is_word(first) {
        return None;
    }
    let rest = &text[pos + 1..];
    Some(pos + 1 + rest.len() - rest.trim_start_matches(|c| js_is_word(c) || c == '-').len())
}

/// Tokenize the body of a LiquidDoc block (level 1). `start_offset` is the
/// source offset of `body[0]`.
pub fn tokenize_liquid_doc(body: &str, start_offset: usize) -> Vec<LiquidDocToken<'_>> {
    let mut tokens = Vec::new();
    let mut pos = 0;
    let mut after_annotation = false;

    while pos < body.len() {
        if let Some(end) = newline_end(body, pos) {
            tokens.push(LiquidDocToken {
                kind: LiquidDocTokenType::Newline,
                value: &body[pos..end],
                start: pos + start_offset,
                end: end + start_offset,
            });
            pos = end;
            after_annotation = false;
            continue;
        }

        let after_ws = blank_end(body, pos).unwrap_or(pos);
        if let Some(end) = annotation_end(body, after_ws) {
            tokens.push(LiquidDocToken {
                kind: LiquidDocTokenType::Annotation,
                value: &body[after_ws + 1..end],
                start: after_ws + start_offset,
                end: end + start_offset,
            });
            pos = end;
            after_annotation = true;
            if let Some(blank) = blank_end(body, pos) {
                pos = blank;
            }
            continue;
        }

        let slice_end = body[pos..].find('\n').map_or(body.len(), |at| pos + at);
        let mut effective_end = slice_end;
        if !after_annotation && let Some(at) = midline_annotation_at(&body[pos..slice_end]) {
            effective_end = pos + at;
        }

        let value = &body[pos..effective_end];
        if !value.is_empty() {
            tokens.push(LiquidDocToken {
                kind: LiquidDocTokenType::TextLine,
                value,
                start: pos + start_offset,
                end: effective_end + start_offset,
            });
        }
        pos = effective_end;
        after_annotation = false;
    }

    tokens.push(LiquidDocToken {
        kind: LiquidDocTokenType::EndOfInput,
        value: "",
        start: body.len() + start_offset,
        end: body.len() + start_offset,
    });
    tokens
}

/// Tokenize the inline content of a `@param` annotation (level 2).
/// `start_offset` is the source offset of `text[0]`.
pub fn tokenize_param_content(text: &str, start_offset: usize) -> Vec<ParamToken<'_>> {
    let mut tokens = Vec::new();
    let mut pos = 0;
    let bytes = text.as_bytes();

    while pos < text.len() {
        if let Some(end) = blank_end(text, pos) {
            pos = end;
            continue;
        }

        if let Some(type_end) = read_type_end(text, pos) {
            tokens.push(ParamToken {
                kind: ParamTokenType::Type,
                value: &text[pos + 1..type_end - 1],
                start: pos + start_offset,
                end: type_end + start_offset,
            });
            pos = type_end;
            continue;
        }

        if let Some(end) = optional_name_end(text, pos) {
            tokens.push(ParamToken {
                kind: ParamTokenType::OptionalName,
                value: &text[pos + 1..end - 1],
                start: pos + start_offset,
                end: end + start_offset,
            });
            pos = end;
            continue;
        }

        let dash_ends = pos + 1 >= text.len() || matches!(bytes[pos + 1], b' ' | b'\t');
        if bytes[pos] == b'-' && dash_ends {
            tokens.push(ParamToken {
                kind: ParamTokenType::Dash,
                value: "-",
                start: pos + start_offset,
                end: pos + 1 + start_offset,
            });
            pos += 1;
            continue;
        }

        if let Some(end) = word_end(text, pos) {
            tokens.push(ParamToken {
                kind: ParamTokenType::Word,
                value: &text[pos..end],
                start: pos + start_offset,
                end: end + start_offset,
            });
            pos = end;
            continue;
        }

        tokens.push(ParamToken {
            kind: ParamTokenType::Text,
            value: &text[pos..],
            start: pos + start_offset,
            end: text.len() + start_offset,
        });
        pos = text.len();
    }

    tokens.push(ParamToken {
        kind: ParamTokenType::EndOfInput,
        value: "",
        start: text.len() + start_offset,
        end: text.len() + start_offset,
    });
    tokens
}

/// Returns the exclusive end of the `{type}` annotation at `start`.
///
/// TS steps one code unit at a time and compares each with an ASCII
/// character. A multi-byte character holds no ASCII byte, so stepping bytes
/// gives the same result.
fn read_type_end(text: &str, start: usize) -> Option<usize> {
    let bytes = text.as_bytes();
    if bytes[start] != b'{' {
        return None;
    }

    let mut pos = start + 1;
    while pos < bytes.len() {
        let ch = bytes[pos];
        if ch == b'\'' || ch == b'"' {
            let Some(close_quote) = find_byte(bytes, ch, pos + 1) else {
                return find_byte(bytes, b'}', pos + 1).map(|type_end| type_end + 1);
            };
            pos = close_quote + 1;
            continue;
        }
        if ch == b'}' {
            return Some(pos + 1);
        }
        pos += 1;
    }
    None
}

/// JS `text.indexOf(ch, from)` for an ASCII `ch`.
fn find_byte(bytes: &[u8], ch: u8, from: usize) -> Option<usize> {
    bytes[from..]
        .iter()
        .position(|&b| b == ch)
        .map(|at| from + at)
}
