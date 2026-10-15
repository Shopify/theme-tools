//! JS character semantics.
//!
//! The TS parser's regexes have no `u` flag, so their character classes follow
//! ECMAScript rules, which differ from Rust's. For example `\s` includes
//! U+FEFF and `char::is_whitespace` does not. Parser code tests characters only
//! through these helpers.

/// JS `/\s/`: the ECMAScript WhiteSpace and LineTerminator code points.
pub fn js_is_whitespace(c: char) -> bool {
    matches!(
        c,
        '\u{0009}'
            | '\u{000A}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{000D}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

/// JS `/[a-zA-Z]/`.
pub fn js_is_ascii_alpha(c: char) -> bool {
    c.is_ascii_alphabetic()
}

/// JS `/\d/` without the `u` flag: ASCII digits only.
pub fn js_is_digit(c: char) -> bool {
    c.is_ascii_digit()
}

/// JS `/\w/` without the `u` flag: `[A-Za-z0-9_]`.
pub fn js_is_word(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

/// Whether `c` is one UTF-16 code unit equal to the JS string `s`.
///
/// The TS tokenizers compare `source[i]`, a single code unit, with a string. A
/// character outside the BMP is two code units, so it never equals one.
pub fn js_unit_eq(c: char, s: &str) -> bool {
    let mut chars = s.chars();
    c.len_utf16() == 1 && chars.next() == Some(c) && chars.next().is_none()
}
