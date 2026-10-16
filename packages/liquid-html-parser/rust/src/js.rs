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

/// The string keys of `Reflect.ownKeys(Object.prototype)`, in that order, on
/// Node v24.15.0. The TS `in` operator and a plain-object index both find them.
pub const JS_OBJECT_PROTOTYPE_KEYS: [&str; 12] = [
    "constructor",
    "__defineGetter__",
    "__defineSetter__",
    "hasOwnProperty",
    "__lookupGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
    "__proto__",
    "toLocaleString",
];

/// JS `name in {}`: whether a plain object inherits `name` from
/// `Object.prototype`.
pub fn js_object_prototype_has(name: &str) -> bool {
    JS_OBJECT_PROTOTYPE_KEYS.contains(&name)
}

/// JS `JSON.stringify(s)` for a well-formed string: `"` and `\` take a
/// backslash, `\b \f \n \r \t` are written by name, every other U+0000 to
/// U+001F is `\u00xx` in lowercase hex, and nothing else is escaped.
pub fn js_json_stringify_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{0008}' => out.push_str("\\b"),
            '\u{000C}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{0000}'..='\u{001F}' => out.push_str(&format!("\\u{:04x}", c as u32)),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

#[cfg(test)]
mod tests {
    use super::js_json_stringify_str;

    #[test]
    fn json_stringify_escapes_quote_and_backslash() {
        assert_eq!(js_json_stringify_str("a\"b"), r#""a\"b""#);
        assert_eq!(js_json_stringify_str("a\\b"), r#""a\\b""#);
    }

    #[test]
    fn json_stringify_names_short_escapes() {
        assert_eq!(js_json_stringify_str("\n"), r#""\n""#);
        assert_eq!(
            js_json_stringify_str("\u{0008}\u{000C}\r\t"),
            r#""\b\f\r\t""#
        );
    }

    #[test]
    fn json_stringify_writes_other_controls_as_lowercase_hex() {
        assert_eq!(js_json_stringify_str("\u{0001}"), r#""\u0001""#);
        assert_eq!(js_json_stringify_str("\u{001F}"), r#""\u001f""#);
    }

    #[test]
    fn json_stringify_leaves_del_and_line_separator() {
        assert_eq!(js_json_stringify_str("\u{007F}"), "\"\u{007F}\"");
        assert_eq!(js_json_stringify_str("\u{2028}"), "\"\u{2028}\"");
    }
}
