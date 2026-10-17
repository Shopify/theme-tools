//! Port of `src/markup/tokenizer.ts`.
//!
//! Token offsets and values are byte offsets and slices of the markup. Callers
//! convert offsets to UTF-16 with `offsets::Utf16Offsets` and add the TS
//! `startOffset` when they are emitted to JS.
//!
//! The TS tokenizer skips one UTF-16 code unit at a time over characters it
//! does not know, and this one skips one character. Every pattern it matches
//! starts with an ASCII character, so the two agree.

use crate::js::{js_is_ascii_alpha, js_is_digit, js_is_word, js_trim_start};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarkupTokenType {
    Id,
    String,
    Number,
    Dot,
    DotDot,
    Pipe,
    Colon,
    Comma,
    OpenRound,
    CloseRound,
    OpenSquare,
    CloseSquare,
    Dash,
    Comparison,
    Equality,
    Logical,
    EndOfString,
}

impl MarkupTokenType {
    pub fn as_str(self) -> &'static str {
        match self {
            MarkupTokenType::Id => "Id",
            MarkupTokenType::String => "String",
            MarkupTokenType::Number => "Number",
            MarkupTokenType::Dot => "Dot",
            MarkupTokenType::DotDot => "DotDot",
            MarkupTokenType::Pipe => "Pipe",
            MarkupTokenType::Colon => "Colon",
            MarkupTokenType::Comma => "Comma",
            MarkupTokenType::OpenRound => "OpenRound",
            MarkupTokenType::CloseRound => "CloseRound",
            MarkupTokenType::OpenSquare => "OpenSquare",
            MarkupTokenType::CloseSquare => "CloseSquare",
            MarkupTokenType::Dash => "Dash",
            MarkupTokenType::Comparison => "Comparison",
            MarkupTokenType::Equality => "Equality",
            MarkupTokenType::Logical => "Logical",
            MarkupTokenType::EndOfString => "EndOfString",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MarkupToken<'a> {
    pub kind: MarkupTokenType,
    pub value: &'a str,
    pub start: usize,
    pub end: usize,
}

pub fn tokenize_markup(markup: &str) -> Vec<MarkupToken<'_>> {
    let bytes = markup.as_bytes();
    let mut tokens = Vec::new();
    let mut pos = 0;
    let mut last_token_type: Option<MarkupTokenType> = None;

    while pos < bytes.len() {
        let after_space = match_whitespace(markup, pos);
        if after_space > pos {
            pos = after_space;
            continue;
        }

        let Some((kind, end)) = scan_token(bytes, pos, last_token_type) else {
            // Unknown character: skip it (should not happen in valid Liquid markup)
            pos += char_len_at(markup, pos);
            continue;
        };
        tokens.push(MarkupToken {
            kind,
            value: &markup[pos..end],
            start: pos,
            end,
        });
        last_token_type = Some(kind);
        pos = end;
    }

    tokens.push(MarkupToken {
        kind: MarkupTokenType::EndOfString,
        value: "",
        start: bytes.len(),
        end: bytes.len(),
    });
    tokens
}

/// TS tokenizeMarkup(markup, startOffset).
pub fn tokenize_markup_at(markup: &str, start_offset: usize) -> Vec<MarkupToken<'_>> {
    tokenize_markup(markup)
        .into_iter()
        .map(|token| MarkupToken {
            start: token.start + start_offset,
            end: token.end + start_offset,
            ..token
        })
        .collect()
}

/// The token starting at `pos`, as its type and end, in the TS check order.
fn scan_token(
    bytes: &[u8],
    pos: usize,
    last_token_type: Option<MarkupTokenType>,
) -> Option<(MarkupTokenType, usize)> {
    let ch = bytes[pos];
    let next = bytes.get(pos + 1).copied();

    if let Some(end) = match_string(bytes, pos) {
        return Some((MarkupTokenType::String, end));
    }
    if ch == b'-' && next.is_some_and(|c| js_is_digit(c as char)) {
        return Some((MarkupTokenType::Number, match_number(bytes, pos + 1)));
    }
    if js_is_digit(ch as char) {
        return Some((MarkupTokenType::Number, match_number(bytes, pos)));
    }
    if let Some(end) = match_id(bytes, pos) {
        return Some((id_type(&bytes[pos..end], last_token_type), end));
    }
    if let Some(kind) = next.and_then(|next| two_char(ch, next)) {
        return Some((kind, pos + 2));
    }
    single_char(ch).map(|kind| (kind, pos + 1))
}

/// JS `/\s+/y`: the end of the whitespace run at `pos`, or `pos` if none.
fn match_whitespace(markup: &str, pos: usize) -> usize {
    markup.len() - js_trim_start(&markup[pos..]).len()
}

/// JS `/'[^']*'/y` or `/"[^"]*"/y`, picked by the quote at `pos`.
fn match_string(bytes: &[u8], pos: usize) -> Option<usize> {
    let quote = bytes[pos];
    if quote != b'\'' && quote != b'"' {
        return None;
    }
    let close = bytes[pos + 1..].iter().position(|&b| b == quote)?;
    Some(pos + 1 + close + 1)
}

/// JS `/\d[\d_]*(\.\d[\d_]*)?/y`, given a digit at `pos`.
fn match_number(bytes: &[u8], pos: usize) -> usize {
    let integer_end = skip_digits_and_underscores(bytes, pos + 1);
    let has_fraction = bytes.get(integer_end) == Some(&b'.')
        && bytes
            .get(integer_end + 1)
            .is_some_and(|&c| js_is_digit(c as char));
    if !has_fraction {
        return integer_end;
    }
    skip_digits_and_underscores(bytes, integer_end + 2)
}

fn skip_digits_and_underscores(bytes: &[u8], from: usize) -> usize {
    let run = bytes[from..]
        .iter()
        .take_while(|&&c| js_is_digit(c as char) || c == b'_')
        .count();
    from + run
}

/// JS `/[a-zA-Z_][\w-]*\??/y`.
fn match_id(bytes: &[u8], pos: usize) -> Option<usize> {
    let first = bytes[pos] as char;
    if !(js_is_ascii_alpha(first) || first == '_') {
        return None;
    }
    let run = bytes[pos + 1..]
        .iter()
        .take_while(|&&c| js_is_word(c as char) || c == b'-')
        .count();
    let end = pos + 1 + run;
    Some(if bytes.get(end) == Some(&b'?') {
        end + 1
    } else {
        end
    })
}

/// `contains`, `and`, and `or` are operators, except right after a `.`.
fn id_type(value: &[u8], last_token_type: Option<MarkupTokenType>) -> MarkupTokenType {
    if last_token_type == Some(MarkupTokenType::Dot) {
        return MarkupTokenType::Id;
    }
    match value {
        b"contains" => MarkupTokenType::Comparison,
        b"and" | b"or" => MarkupTokenType::Logical,
        _ => MarkupTokenType::Id,
    }
}

fn two_char(ch: u8, next: u8) -> Option<MarkupTokenType> {
    match [ch, next] {
        [b'=', b'='] | [b'!', b'='] => Some(MarkupTokenType::Equality),
        [b'>', b'='] | [b'<', b'='] => Some(MarkupTokenType::Comparison),
        [b'.', b'.'] => Some(MarkupTokenType::DotDot),
        _ => None,
    }
}

fn single_char(ch: u8) -> Option<MarkupTokenType> {
    match ch {
        b'.' => Some(MarkupTokenType::Dot),
        b'|' => Some(MarkupTokenType::Pipe),
        b':' => Some(MarkupTokenType::Colon),
        b',' => Some(MarkupTokenType::Comma),
        b'(' => Some(MarkupTokenType::OpenRound),
        b')' => Some(MarkupTokenType::CloseRound),
        b'[' => Some(MarkupTokenType::OpenSquare),
        b']' => Some(MarkupTokenType::CloseSquare),
        b'-' => Some(MarkupTokenType::Dash),
        b'>' | b'<' => Some(MarkupTokenType::Comparison),
        b'=' => Some(MarkupTokenType::Equality),
        _ => None,
    }
}

fn char_len_at(markup: &str, pos: usize) -> usize {
    markup[pos..].chars().next().map_or(1, char::len_utf8)
}
