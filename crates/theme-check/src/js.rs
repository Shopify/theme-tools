//! JS semantics that TS checks lean on and Rust doesn't share.

use serde_json::Value;

/// JS whitespace (`String#trim`, regex `\s`): Rust's `char::is_whitespace` minus U+0085, plus
/// U+FEFF.
pub fn is_space(c: char) -> bool {
    c == '\u{feff}' || (c.is_whitespace() && c != '\u{85}')
}

/// `s.trim()`
pub fn trim(s: &str) -> &str {
    s.trim_matches(is_space)
}

pub fn trim_start(s: &str) -> &str {
    s.trim_start_matches(is_space)
}

pub fn trim_end(s: &str) -> &str {
    s.trim_end_matches(is_space)
}

/// UTF-16 length (`s.length`).
pub fn len16(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

/// `typeof v === 'object'` (includes `null` and arrays).
pub fn is_object_like(v: &Value) -> bool {
    matches!(v, Value::Null | Value::Array(_) | Value::Object(_))
}

/// `typeof v === 'object' && v !== null`
pub fn is_non_null_object(v: &Value) -> bool {
    matches!(v, Value::Array(_) | Value::Object(_))
}

/// `v[key]` on a defined value, `None` = `undefined`. Arrays index by integer keys and have
/// `length`; strings too. Throws like JS on `null`.
pub fn get<'v>(v: &'v Value, key: &str) -> Result<Option<&'v Value>, String> {
    match v {
        Value::Null => Err(format!("Cannot read properties of null (reading '{key}')")),
        Value::Object(m) => Ok(m.get(key)),
        Value::Array(a) => Ok(array_index(key).and_then(|i| a.get(i))),
        _ => Ok(None),
    }
}

/// `key` as an array index: canonical integers only (`a["01"]` and `a["+1"]` are undefined).
fn array_index(key: &str) -> Option<usize> {
    key.parse::<usize>().ok().filter(|i| i.to_string() == key)
}

/// `key in v`. Throws like JS on primitives.
pub fn has(v: &Value, key: &str) -> Result<bool, String> {
    match v {
        Value::Object(m) => Ok(m.contains_key(key)),
        Value::Array(a) => Ok(key == "length" || array_index(key).is_some_and(|i| i < a.len())),
        _ => Err(format!(
            "Cannot use 'in' operator to search for '{key}' in {}",
            to_string(v)
        )),
    }
}

/// `Object.entries(v)` for a defined value (strings give their UTF-16 units, which we
/// approximate with chars). Throws like JS on `null`.
pub fn entries(v: &Value) -> Result<Vec<(String, Value)>, String> {
    match v {
        Value::Null => Err("Cannot convert undefined or null to object".into()),
        Value::Object(m) => Ok(m.iter().map(|(k, v)| (k.clone(), v.clone())).collect()),
        Value::Array(a) => Ok(a
            .iter()
            .enumerate()
            .map(|(i, v)| (i.to_string(), v.clone()))
            .collect()),
        Value::String(s) => Ok(s
            .chars()
            .enumerate()
            .map(|(i, c)| (i.to_string(), Value::String(c.into())))
            .collect()),
        _ => Ok(Vec::new()),
    }
}

/// `String(v)` / `${v}`.
pub fn to_string(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n
            .as_f64()
            .map_or_else(|| n.to_string(), crate::json::js_number_to_string),
        Value::String(s) => s.clone(),
        Value::Array(a) => a
            .iter()
            .map(|v| {
                if v.is_null() {
                    String::new()
                } else {
                    to_string(v)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `undefined`-aware `String(v)`.
pub fn opt_to_string(v: Option<&Value>) -> String {
    v.map_or_else(|| "undefined".into(), to_string)
}

/// `Number(s)` (JS StringToNumber).
pub fn string_to_number(s: &str) -> f64 {
    let s = trim(s);
    if s.is_empty() {
        return 0.0;
    }
    let radix = match s.get(..2) {
        Some("0x" | "0X") => 16,
        Some("0o" | "0O") => 8,
        Some("0b" | "0B") => 2,
        _ => 10,
    };
    if radix != 10 {
        let digits = &s[2..];
        if digits.is_empty() || !digits.chars().all(|c| c.is_digit(radix)) {
            return f64::NAN;
        }
        return digits.chars().fold(0.0, |n, c| {
            n * radix as f64 + c.to_digit(radix).unwrap() as f64
        });
    }
    match s.strip_prefix(['+', '-']).unwrap_or(s) {
        "Infinity" => {
            return if s.starts_with('-') {
                f64::NEG_INFINITY
            } else {
                f64::INFINITY
            }
        }
        // Rust also parses "inf", "nan", ...; JS only takes decimal literals.
        rest if !rest
            .bytes()
            .all(|b| b.is_ascii_digit() || matches!(b, b'.' | b'e' | b'E' | b'+' | b'-')) =>
        {
            return f64::NAN
        }
        _ => {}
    }
    s.parse().unwrap_or(f64::NAN)
}

/// `Number(v)` / `+v` for a JSON value.
pub fn to_number(v: &Value) -> f64 {
    match v {
        Value::Null => 0.0,
        Value::Bool(b) => *b as u8 as f64,
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        Value::String(s) => string_to_number(s),
        Value::Array(_) => string_to_number(&to_string(v)),
        Value::Object(_) => f64::NAN,
    }
}

/// `parseFloat(s)`: the longest decimal-literal prefix after leading whitespace, else NaN.
pub fn parse_float(s: &str) -> f64 {
    let s = trim_start(s);
    let b = s.as_bytes();
    let digits = |mut i: usize| {
        while b.get(i).is_some_and(u8::is_ascii_digit) {
            i += 1;
        }
        i
    };
    let sign = usize::from(matches!(b.first(), Some(b'+' | b'-')));
    if s[sign..].starts_with("Infinity") {
        return if s.starts_with('-') {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };
    }
    let int_end = digits(sign);
    let mut end = int_end;
    if b.get(end) == Some(&b'.') {
        let frac_end = digits(end + 1);
        if frac_end > end + 1 || int_end > sign {
            end = frac_end;
        }
    }
    if end == sign {
        return f64::NAN;
    }
    if matches!(b.get(end), Some(b'e' | b'E')) {
        let exp_sign = end + 1 + usize::from(matches!(b.get(end + 1), Some(b'+' | b'-')));
        let exp_end = digits(exp_sign);
        if exp_end > exp_sign {
            end = exp_end;
        }
    }
    s[..end].parse().unwrap_or(f64::NAN)
}

pub use crate::json::truthy;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn js_semantics() {
        assert_eq!(trim("\u{feff} a\u{85}"), "a\u{85}");
        assert_eq!(to_string(&json!([1, null, "x", [2, 3]])), "1,,x,2,3");
        assert_eq!(to_string(&json!(1.5)), "1.5");
        assert!(get(&json!(null), "a").is_err());
        assert_eq!(get(&json!(["a"]), "0").unwrap(), Some(&json!("a")));
        assert_eq!(get(&json!(["a", "b"]), "01").unwrap(), None);
        assert!(!has(&json!(["a", "b"]), "+1").unwrap());
        assert!(has(&json!(5), "a").is_err());
        assert_eq!(entries(&json!("ab")).unwrap().len(), 2);
        assert_eq!(to_number(&json!(" 12 ")), 12.0);
        assert_eq!(to_number(&json!("0x1f")), 31.0);
        assert_eq!(to_number(&json!([5])), 5.0);
        assert_eq!(to_number(&json!("")), 0.0);
        assert!(to_number(&json!("inf")).is_nan());
        assert!(to_number(&json!("-0x1")).is_nan());
        assert!(to_number(&json!([1, 2])).is_nan());
        assert_eq!(to_number(&json!("-Infinity")), f64::NEG_INFINITY);
        assert_eq!(parse_float(" 12.5kB"), 12.5);
        assert_eq!(parse_float("1e3, 7"), 1000.0);
        assert_eq!(parse_float(".5"), 0.5);
        assert_eq!(parse_float("5."), 5.0);
        assert_eq!(parse_float("1e"), 1.0);
        assert!(parse_float(".").is_nan());
        assert!(parse_float("").is_nan());
        assert!(parse_float("0x10") == 0.0);
    }
}
