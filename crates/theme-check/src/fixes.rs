//! `fixes/`: correctors, `flattenFixes`, `applyFixToString` and `autofix`.
//!
//! A TS fixer is a closure that calls its corrector. Liquid fixers only push text edits, so an
//! offense keeps those edits. JSON fixers queue patches that are only applied, all together, when
//! the corrector's `fix` is read, so an offense keeps the patches and `corrector_fix` replays them
//! on one corrector, as TS `autofix` does.

use crate::context::Offense;
use crate::js;
use crate::json::{js_insert, js_number_to_string, js_number_value};
use crate::source::SourceCode;
use serde_json::{Map, Value};
use std::collections::HashMap;

/// TS `FixDescription`, in UTF-8 byte offsets into the file's source.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TextEdit {
    pub start: usize,
    pub end: usize,
    pub insert: String,
}

/// A `JSONCorrector` patch (`replace` is a remove then an add).
#[derive(Clone, Debug, PartialEq)]
pub enum JsonPatch {
    Add(String, Value),
    Remove(String),
}

/// What a fixer does to its corrector: `StringCorrector` edits or `JSONCorrector` patches.
#[derive(Clone, Debug, PartialEq)]
pub enum Fix {
    Text(Vec<TextEdit>),
    Json(Vec<JsonPatch>),
}

impl Fix {
    /// `corrector.replace(start, end, text)`
    pub fn replace(start: usize, end: usize, text: impl Into<String>) -> Fix {
        Fix::Text(vec![TextEdit {
            start,
            end,
            insert: text.into(),
        }])
    }
    /// `corrector.insert(index, text)`
    pub fn insert(index: usize, text: impl Into<String>) -> Fix {
        Fix::replace(index, index, text)
    }
    /// `corrector.remove(start, end)`
    pub fn remove(start: usize, end: usize) -> Fix {
        Fix::replace(start, end, "")
    }
    /// `corrector.add(path, value)` (JSON)
    pub fn json_add(path: impl Into<String>, value: Value) -> Fix {
        Fix::Json(vec![JsonPatch::Add(path.into(), value)])
    }
    /// `corrector.remove(path)` (JSON)
    pub fn json_remove(path: impl Into<String>) -> Fix {
        Fix::Json(vec![JsonPatch::Remove(path.into())])
    }
}

/// TS `Suggestion`.
#[derive(Clone, Debug, PartialEq)]
pub struct Suggestion {
    pub message: String,
    pub fix: Fix,
}

impl Suggestion {
    pub fn new(message: impl Into<String>, fix: Fix) -> Self {
        Suggestion {
            message: message.into(),
            fix,
        }
    }
}

/// `createCorrector(file.type, file.source)`, every fixer run on it in order, then
/// `flattenFixes(corrector.fix)`. `Err` is what reading a JSON corrector's `fix` throws.
pub fn corrector_fix<'f>(
    file: &SourceCode,
    fixes: impl IntoIterator<Item = &'f Fix>,
) -> Result<Vec<TextEdit>, String> {
    if file.is_liquid() {
        let mut edits = Vec::new();
        for fix in fixes {
            if let Fix::Text(e) = fix {
                edits.extend(e.iter().cloned());
            }
        }
        return Ok(edits);
    }
    let patches: Vec<&JsonPatch> = fixes
        .into_iter()
        .flat_map(|f| match f {
            Fix::Json(p) => p.as_slice(),
            Fix::Text(_) => &[],
        })
        .collect();
    if patches.is_empty() {
        return Ok(Vec::new());
    }
    let mut json = json_parse(file.source)?;
    for patch in patches {
        match patch {
            JsonPatch::Add(path, value) => lodash_set(&mut json, path, value.clone())?,
            JsonPatch::Remove(path) => lodash_unset(&mut json, path),
        }
    }
    let mut insert = String::new();
    stringify(&json, "", &mut insert);
    if js::len16(&insert) > MAX_STRING_LENGTH {
        return Err(INVALID_STRING_LENGTH.into());
    }
    Ok(vec![TextEdit {
        start: 0,
        end: file.source.len(),
        insert,
    }])
}

/// `applyFixToString(source, fixes)`
pub fn apply_fix_to_string(source: &str, fixes: &[TextEdit]) -> Result<String, String> {
    let mut sorted: Vec<&TextEdit> = fixes.iter().collect();
    sorted.sort_by_key(|f| f.start);
    if sorted.windows(2).any(|w| w[0].end > w[1].start) {
        return Err("Overlapping ranges are not allowed".into());
    }
    let mut out = source.to_string();
    let mut offset: isize = 0;
    for fix in sorted {
        let start = fix.start as isize + offset;
        let end = fix.end as isize + offset;
        let len = out.len() as isize;
        if start < 0 || start > len || end < start || end > len {
            return Err("Fix description is going overboard".into());
        }
        let (start, end) = (start as usize, end as usize);
        // ponytail: TS slices UTF-16 units; an edit inside a character can't be applied to a Rust
        // string. AST offsets never do that.
        if !out.is_char_boundary(start) || !out.is_char_boundary(end) {
            return Err("Fix description splits a character".into());
        }
        out.replace_range(start..end, &fix.insert);
        offset += fix.insert.len() as isize - (end - start) as isize;
    }
    Ok(out)
}

/// `autofix(theme, offenses, applyFixes)` with `applyFixToString` as the applicator: the new
/// source of each fixed file, in theme order, or the error `applyFixToString` threw for it. A
/// JSON corrector that throws rejects the whole TS call; that ends the list with `("*", Err)`,
/// as the spec recorder writes it.
pub fn autofix(
    theme: &[SourceCode],
    offenses: &[Offense],
) -> Vec<(String, Result<String, String>)> {
    let mut by_uri: HashMap<&str, Vec<&Fix>> = HashMap::new();
    for o in offenses {
        if let Some(fix) = &o.fix {
            by_uri.entry(&o.uri).or_default().push(fix);
        }
    }
    let mut out = Vec::new();
    for file in theme {
        let Some(fixes) = by_uri.get(file.uri.as_str()) else {
            continue;
        };
        match corrector_fix(file, fixes.iter().copied()) {
            Ok(edits) => out.push((file.uri.clone(), apply_fix_to_string(file.source, &edits))),
            Err(e) => {
                out.push(("*".into(), Err(e)));
                break;
            }
        }
    }
    out
}

// ---------------------------------------------------------------------------------------------
// JSON.parse / JSON.stringify(json, null, 2)

/// `JSON.parse(source)` with JS numbers and key order. ponytail: serde_json's messages, not V8's;
/// best-effort float precision; nesting limited to 128; lone surrogates and out-of-range numbers
/// are errors here. Locale files never hit these.
fn json_parse(source: &str) -> Result<Value, String> {
    fn js(v: Value) -> Value {
        match v {
            Value::Number(n) => js_number_value(n.as_f64().unwrap_or(f64::NAN)),
            Value::Array(a) => Value::Array(a.into_iter().map(js).collect()),
            Value::Object(m) => {
                let mut out = Map::new();
                for (k, v) in m {
                    js_insert(&mut out, k, js(v));
                }
                Value::Object(out)
            }
            v => v,
        }
    }
    serde_json::from_str(source)
        .map(js)
        .map_err(|e| e.to_string())
}

fn stringify(v: &Value, indent: &str, out: &mut String) {
    match v {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Number(n) => match n.as_i64() {
            Some(i) => out.push_str(&i.to_string()),
            None => out.push_str(&js_number_to_string(n.as_f64().unwrap_or(f64::NAN))),
        },
        Value::String(s) => quote(s, out),
        Value::Array(a) if a.is_empty() => out.push_str("[]"),
        Value::Object(m) if m.is_empty() => out.push_str("{}"),
        Value::Array(a) => {
            let inner = format!("{indent}  ");
            out.push('[');
            for (i, item) in a.iter().enumerate() {
                out.push_str(if i == 0 { "\n" } else { ",\n" });
                out.push_str(&inner);
                stringify(item, &inner, out);
            }
            out.push('\n');
            out.push_str(indent);
            out.push(']');
        }
        Value::Object(m) => {
            let inner = format!("{indent}  ");
            out.push('{');
            for (i, (k, item)) in m.iter().enumerate() {
                out.push_str(if i == 0 { "\n" } else { ",\n" });
                out.push_str(&inner);
                quote(k, out);
                out.push_str(": ");
                stringify(item, &inner, out);
            }
            out.push('\n');
            out.push_str(indent);
            out.push('}');
        }
    }
}

/// `JSON.stringify(string)`
fn quote(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

// ---------------------------------------------------------------------------------------------
// lodash 4.18 `set` / `unset` on string paths

/// `isObject(value)`
fn is_object(v: &Value) -> bool {
    matches!(v, Value::Object(_) | Value::Array(_))
}

/// `isIndex(value)`: `/^(?:0|[1-9]\d*)$/` below `MAX_SAFE_INTEGER`.
fn is_index(key: &str) -> bool {
    let b = key.as_bytes();
    !b.is_empty()
        && b.iter().all(u8::is_ascii_digit)
        && (b[0] != b'0' || b.len() == 1)
        && key.parse::<u64>().is_ok_and(|n| n < 9007199254740991)
}

/// A JS array index key ("0".."4294967294"), which `arr[key] = v` writes as an element.
fn array_index(key: &str) -> Option<usize> {
    is_index(key)
        .then(|| key.parse::<u64>().ok())
        .flatten()
        .filter(|&n| n < u32::MAX as u64)
        .map(|n| n as usize)
}

/// `reIsDeepProp.test(value)`: `/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/`
fn is_deep_prop(s: &str) -> bool {
    let b = s.as_bytes();
    if b.contains(&b'.') {
        return true;
    }
    (0..b.len()).filter(|&i| b[i] == b'[').any(|i| {
        let plain = b[i + 1..]
            .iter()
            .position(|c| *c == b'[' || *c == b']')
            .is_some_and(|j| b[i + 1 + j] == b']');
        plain || quoted_bracket(s, i).is_some()
    })
}

/// `\[(["'])((?:(?!\1)[^\\]|\\.)*?)\1\]` at `i`: the content's byte range and the match end.
fn quoted_bracket(s: &str, i: usize) -> Option<(usize, usize, usize)> {
    let b = s.as_bytes();
    let q = *b.get(i + 1).filter(|c| **c == b'"' || **c == b'\'')?;
    let mut j = i + 2;
    loop {
        match *b.get(j)? {
            c if c == q => return (b.get(j + 1) == Some(&b']')).then_some((i + 2, j, j + 2)),
            b'\\' => {
                // `\\.`: `.` stops at line terminators.
                let next = s[j + 1..].chars().next()?;
                if matches!(next, '\n' | '\r' | '\u{2028}' | '\u{2029}') {
                    return None;
                }
                j += 1 + next.len_utf8();
            }
            _ => j += 1,
        }
    }
}

/// `castPath(path, object)` for a string path.
fn cast_path(path: &str, root: &Value) -> Vec<String> {
    // isKey: `/^\w*$/`, not deep, or already a key of the object.
    let plain = path.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_');
    if plain || !is_deep_prop(path) || matches!(root, Value::Object(m) if m.contains_key(path)) {
        return vec![path.to_string()];
    }
    string_to_path(path)
}

/// `stringToPath(string)`: the `rePropName` global replace.
fn string_to_path(s: &str) -> Vec<String> {
    let b = s.as_bytes();
    let mut out = Vec::new();
    if b.first() == Some(&b'.') {
        out.push(String::new());
    }
    let mut i = 0;
    while i < b.len() {
        // `[^.[\]]+`
        let run = b[i..]
            .iter()
            .position(|c| matches!(c, b'.' | b'[' | b']'))
            .unwrap_or(b.len() - i);
        if run > 0 {
            out.push(s[i..i + run].to_string());
            i += run;
            continue;
        }
        if b[i] == b'[' {
            // `\[(-?\d+(?:\.\d+)?)\]`
            let mut j = i + 1 + (b.get(i + 1) == Some(&b'-')) as usize;
            let digits = b[j..].iter().take_while(|c| c.is_ascii_digit()).count();
            if digits > 0 {
                j += digits;
                let frac = if b.get(j) == Some(&b'.') {
                    b[j + 1..].iter().take_while(|c| c.is_ascii_digit()).count()
                } else {
                    0
                };
                let end = if frac > 0 && b.get(j + 1 + frac) == Some(&b']') {
                    Some(j + 1 + frac)
                } else {
                    (b.get(j) == Some(&b']')).then_some(j)
                };
                if let Some(end) = end {
                    out.push(s[i + 1..end].to_string());
                    i = end + 1;
                    continue;
                }
            }
            // `\[(["'])(...)\1\]`, unescaped with `/\\(\\)?/g` → `$1`.
            if let Some((from, to, end)) = quoted_bracket(s, i) {
                let mut key = String::new();
                let mut chars = s[from..to].chars().peekable();
                while let Some(c) = chars.next() {
                    if c == '\\' {
                        if chars.peek() == Some(&'\\') {
                            key.push(chars.next().unwrap());
                        }
                    } else {
                        key.push(c);
                    }
                }
                out.push(key);
                i = end;
                continue;
            }
        }
        // `(?=(?:\.|\[\])(?:\.|\[\]|$))`: an empty key, then step one unit.
        let sep = |k: usize| match b.get(k) {
            Some(b'.') => Some(k + 1),
            Some(b'[') if b.get(k + 1) == Some(&b']') => Some(k + 2),
            _ => None,
        };
        if let Some(k) = sep(i) {
            if k == b.len() || sep(k).is_some() {
                out.push(String::new());
            }
        }
        i += 1;
    }
    out
}

/// V8's maximum string length: `JSON.stringify` throws past it.
const MAX_STRING_LENGTH: usize = (1 << 29) - 24;
const INVALID_STRING_LENGTH: &str = "Invalid string length";

/// `_.set(json, path, value)`: the `baseSet` loop. ponytail: a non-index key on an array (a JS
/// expando property, which `JSON.stringify` drops; `length` throws) ends the operation instead.
/// `Err` is the `JSON.stringify` throw for an index whose holes alone overflow
/// `MAX_STRING_LENGTH`. ponytail: holes are dense `null`s here (V8 keeps them sparse), so an
/// index just under that costs ~32 bytes per hole.
fn lodash_set(root: &mut Value, path: &str, value: Value) -> Result<(), String> {
    if !is_object(root) {
        return Ok(());
    }
    let keys = cast_path(path, root);
    let mut value = Some(value);
    let mut nested = root;
    for (index, key) in keys.iter().enumerate() {
        if matches!(key.as_str(), "__proto__" | "constructor" | "prototype") {
            return Ok(());
        }
        let is_last = index == keys.len() - 1;
        // The value to assign: `value` last, else the existing object or a new `[]` / `{}`.
        let new_value = |existing: Option<&Value>, value: &mut Option<Value>| {
            if is_last {
                value.take()
            } else if existing.is_some_and(is_object) {
                None
            } else if is_index(&keys[index + 1]) {
                Some(Value::Array(Vec::new()))
            } else {
                Some(Value::Object(Map::new()))
            }
        };
        nested = match nested {
            Value::Object(m) => {
                if let Some(v) = new_value(m.get(key.as_str()), &mut value) {
                    js_insert(m, key.clone(), v);
                }
                m.get_mut(key.as_str()).unwrap()
            }
            Value::Array(a) => {
                let Some(i) = array_index(key) else {
                    return Ok(());
                };
                if let Some(v) = new_value(a.get(i), &mut value) {
                    if i >= a.len() {
                        // Each element prints as at least `\n  null` (7 units).
                        if i >= MAX_STRING_LENGTH / 7 {
                            return Err(INVALID_STRING_LENGTH.into());
                        }
                        a.resize(i + 1, Value::Null);
                    }
                    a[i] = v;
                }
                &mut a[i]
            }
            _ => return Ok(()),
        };
    }
    Ok(())
}

/// `_.unset(json, path)`: `delete parent[last]`. Array holes become `null`, which is how
/// `JSON.stringify` prints them.
fn lodash_unset(root: &mut Value, path: &str) {
    let keys = cast_path(path, root);
    let Some((last, init)) = keys.split_last() else {
        return;
    };
    let own_proto = matches!(root, Value::Object(m) if m.contains_key("__proto__"));
    for (i, k) in keys.iter().enumerate() {
        if (k == "__proto__" && !own_proto)
            || (matches!(k.as_str(), "constructor" | "prototype") && i < keys.len() - 1)
        {
            return;
        }
    }
    let mut parent = root;
    for k in init {
        parent = match parent {
            Value::Object(m) => match m.get_mut(k.as_str()) {
                Some(v) => v,
                None => return,
            },
            Value::Array(a) => match array_index(k).and_then(|i| a.get_mut(i)) {
                Some(v) => v,
                None => return,
            },
            _ => return,
        };
    }
    match parent {
        Value::Object(m) => {
            m.shift_remove(last.as_str());
        }
        Value::Array(a) => {
            if let Some(v) = array_index(last).and_then(|i| a.get_mut(i)) {
                *v = Value::Null;
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::to_source_code;

    fn edit(start: usize, end: usize, insert: &str) -> TextEdit {
        TextEdit {
            start,
            end,
            insert: insert.into(),
        }
    }

    #[test]
    fn apply_fix_to_string_spec() {
        let s = "Hello, world!";
        assert_eq!(
            apply_fix_to_string(s, &[edit(0, 5, "Hi")]).unwrap(),
            "Hi, world!"
        );
        let fixes = [edit(7, 7, "beautiful "), edit(12, 13, ""), edit(0, 5, "Hi")];
        assert_eq!(
            apply_fix_to_string(s, &fixes).unwrap(),
            "Hi, beautiful world"
        );
        let overlap = [edit(5, 7, "wonderful "), edit(6, 8, "beautiful ")];
        assert_eq!(
            apply_fix_to_string(s, &overlap).unwrap_err(),
            "Overlapping ranges are not allowed"
        );
        let touching = [edit(6, 6, " wonderful"), edit(6, 7, " and beautiful ")];
        assert_eq!(
            apply_fix_to_string(s, &touching).unwrap(),
            "Hello, wonderful and beautiful world!"
        );
        assert_eq!(
            apply_fix_to_string(s, &[edit(0, 20, "Hi")]).unwrap_err(),
            "Fix description is going overboard"
        );
    }

    fn json_fix(source: &str, patches: Vec<JsonPatch>) -> String {
        let file = to_source_code("file:///a.json", source);
        let mut edits = corrector_fix(&file, [&Fix::Json(patches)]).unwrap();
        edits.pop().unwrap().insert
    }

    #[test]
    fn autofix_per_file_errors_and_abort() {
        use crate::context::{Severity, SourceKind};
        use crate::source::Position;
        let offense = |uri: &str, fix: Fix| {
            let p = Position {
                index: 0,
                line: 0,
                character: 0,
            };
            let (check, kind, message, severity) =
                ("X", SourceKind::LiquidHtml, String::new(), Severity::Error);
            Offense {
                check,
                kind,
                uri: uri.into(),
                message,
                severity,
                start_byte: 0,
                end_byte: 0,
                start: p,
                end: p,
                fix: Some(fix),
                suggest: None,
            }
        };
        let theme = [
            to_source_code("file:///a.liquid", "abc"),
            to_source_code("file:///b.liquid", "abc"),
            to_source_code("file:///c.json", "{bad"),
            to_source_code("file:///d.liquid", "abc"),
        ];
        let offenses = [
            offense("file:///d.liquid", Fix::remove(0, 1)),
            offense("file:///b.liquid", Fix::remove(0, 2)),
            offense("file:///b.liquid", Fix::remove(1, 3)),
            offense("file:///a.liquid", Fix::replace(1, 2, "X")),
            offense("file:///c.json", Fix::json_add("a", Value::Null)),
        ];
        let out = autofix(&theme, &offenses);
        let uris: Vec<&str> = out.iter().map(|(u, _)| u.as_str()).collect();
        assert_eq!(uris, ["file:///a.liquid", "file:///b.liquid", "*"]);
        assert_eq!(out[0].1, Ok("aXc".into()));
        assert_eq!(out[1].1, Err("Overlapping ranges are not allowed".into()));
        assert!(out[2].1.is_err());
    }

    #[test]
    fn json_corrector_spec() {
        use JsonPatch::*;
        let add = |p: &str, v: &str| Add(p.into(), Value::String(v.into()));
        let rm = |p: &str| Remove(p.into());
        assert_eq!(
            json_fix(r#"{"a":{"b":"b"}}"#, vec![add("a.c", "c"), add("a.d", "d")]),
            "{\n  \"a\": {\n    \"b\": \"b\",\n    \"c\": \"c\",\n    \"d\": \"d\"\n  }\n}"
        );
        assert_eq!(
            json_fix(
                r#"{"a":{"b":"b"}}"#,
                vec![add("a.b.c", "c"), add("a.b.d", "d")]
            ),
            "{\n  \"a\": {\n    \"b\": {\n      \"c\": \"c\",\n      \"d\": \"d\"\n    }\n  }\n}"
        );
        assert_eq!(
            json_fix(
                r#"{"a":{"b":"b"},"c":{"d":"d","e":"e"},"f":{"g":"g"}}"#,
                vec![rm("a.b"), rm("c.d"), rm("f")]
            ),
            "{\n  \"a\": {},\n  \"c\": {\n    \"e\": \"e\"\n  }\n}"
        );
        // Index keys make arrays, JS numbers and key order, holes print as null.
        assert_eq!(
            json_fix(r#"{"b":1.0,"1":[1,2]}"#, vec![add("x.0", "y"), rm("1.0")]),
            "{\n  \"1\": [\n    null,\n    2\n  ],\n  \"b\": 1,\n  \"x\": [\n    \"y\"\n  ]\n}"
        );
        // A whole-path own key is one key.
        assert_eq!(json_fix(r#"{"a.b":1}"#, vec![rm("a.b")]), "{}");
    }

    #[test]
    fn lodash_paths() {
        let p = |s: &str| string_to_path(s);
        assert_eq!(p("a.b.c"), ["a", "b", "c"]);
        assert_eq!(p("a..b"), ["a", "", "b"]);
        assert_eq!(p(".a"), ["", "a"]);
        assert_eq!(p("a[0].b"), ["a", "0", "b"]);
        assert_eq!(p("a['x.y'].b"), ["a", "x.y", "b"]);
        assert_eq!(p(r#"a["q\\\"x"]"#), ["a", r#"q\"x"#]);
        assert_eq!(p("a[]"), ["a", ""]);
        assert_eq!(p("a."), ["a", ""]);
        assert!(!is_deep_prop("a[b"));
        assert!(is_deep_prop("a[b]"));
    }
}
