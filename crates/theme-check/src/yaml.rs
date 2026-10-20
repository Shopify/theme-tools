//! `yaml@2` `parse(src)` for config files: yaml-rust2's event parser, with yaml@2's YAML 1.2 core
//! schema scalar resolution and its JS object building (`toJS`) on top.

use crate::json::{js_insert, js_number_to_string, js_number_value};
use serde_json::{Map, Value};
use std::collections::HashMap;
use yaml_rust2::parser::{Event, MarkedEventReceiver, Parser};
use yaml_rust2::scanner::{Marker, TScalarStyle};

/// What `parse` throws.
#[derive(Debug, PartialEq)]
pub enum YamlError {
    /// `ReferenceError: Unresolved alias (the anchor must be set before the alias): <name>`
    UnresolvedAlias(String),
    /// `YAMLParseError`. ponytail: syntax errors carry yaml-rust2's message and position, not
    /// yaml@2's; the errors raised here (duplicate keys, multiple documents) match.
    Parse(String),
}

impl YamlError {
    pub fn name(&self) -> &'static str {
        match self {
            YamlError::UnresolvedAlias(_) => "ReferenceError",
            YamlError::Parse(_) => "YAMLParseError",
        }
    }

    pub fn message(&self) -> String {
        match self {
            YamlError::UnresolvedAlias(a) => {
                format!("Unresolved alias (the anchor must be set before the alias): {a}")
            }
            YamlError::Parse(m) => m.clone(),
        }
    }
}

enum Frame {
    Seq(Vec<Value>, usize),
    /// (object, pending key, keys seen as typed scalars for `uniqueKeys`, anchor)
    Map(Map<String, Value>, Option<String>, Vec<Value>, usize),
}

#[derive(Default)]
struct Builder {
    stack: Vec<Frame>,
    anchors: HashMap<usize, Value>,
    docs: usize,
    root: Option<Value>,
    /// The first error yaml@2 would report: (message, char index).
    error: Option<(&'static str, usize)>,
}

/// yaml@2 core schema, in tag order: null, bool, intOct, int, intHex, floatNaN, floatExp, float.
fn resolve_plain(s: &str) -> Value {
    let digits = |s: &str| !s.is_empty() && s.bytes().all(|c| c.is_ascii_digit());
    let unsigned = |s: &str| s.strip_prefix(['-', '+']).unwrap_or(s).to_string();
    match s {
        "" | "~" | "null" | "Null" | "NULL" => return Value::Null,
        "true" | "True" | "TRUE" => return Value::Bool(true),
        "false" | "False" | "FALSE" => return Value::Bool(false),
        _ => {}
    }
    if let Some(oct) = s
        .strip_prefix("0o")
        .filter(|o| !o.is_empty() && o.bytes().all(|c| (b'0'..=b'7').contains(&c)))
    {
        return js_number_value(oct.bytes().fold(0f64, |n, c| n * 8.0 + (c - b'0') as f64));
    }
    if digits(&unsigned(s)) {
        let n: f64 = s.parse().unwrap_or(0.0);
        return js_number_value(if s.starts_with('-') && n == 0.0 {
            -0.0
        } else {
            n
        });
    }
    if let Some(hex) = s
        .strip_prefix("0x")
        .filter(|h| !h.is_empty() && h.bytes().all(|c| c.is_ascii_hexdigit()))
    {
        return js_number_value(
            hex.chars()
                .fold(0f64, |n, c| n * 16.0 + c.to_digit(16).unwrap() as f64),
        );
    }
    // ponytail: NaN and ±Infinity become null (serde_json has no such numbers), so `typeof` checks
    // on them see `object`.
    if matches!(s, ".nan" | ".NaN" | ".NAN")
        || matches!(unsigned(s).as_str(), ".inf" | ".Inf" | ".INF")
    {
        return Value::Null;
    }
    // floatExp / float: `[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)` then `[eE][-+]?[0-9]+` (required for
    // floatExp; float needs a `.` instead).
    let u = unsigned(s);
    let (mantissa, exp) = match u.find(['e', 'E']) {
        Some(i) => (&u[..i], Some(&u[i + 1..])),
        None => (u.as_str(), None),
    };
    let mantissa_ok = match mantissa.split_once('.') {
        Some(("", frac)) => digits(frac),
        Some((int, frac)) => digits(int) && (frac.is_empty() || digits(frac)),
        None => exp.is_some() && digits(mantissa),
    };
    let exp_ok = exp.map_or(true, |e| digits(e.strip_prefix(['-', '+']).unwrap_or(e)));
    if mantissa_ok && exp_ok {
        if let Ok(n) = s.parse::<f64>() {
            return js_number_value(n);
        }
    }
    Value::String(s.to_string())
}

/// yaml@2 `stringifyKey`: the JS property name for a key.
fn js_key(key: &Value) -> String {
    match key {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => js_number_to_string(n.as_f64().unwrap_or(0.0)),
        // ponytail: yaml@2 stringifies collection keys as YAML (with a warning); this is JSON.
        v => v.to_string(),
    }
}

impl Builder {
    /// `at`: the value's char index, for errors.
    fn push(&mut self, value: Value, anchor: usize, at: usize) {
        if anchor != 0 {
            self.anchors.insert(anchor, value.clone());
        }
        match self.stack.last_mut() {
            None => self.root = Some(value),
            Some(Frame::Seq(items, _)) => items.push(value),
            Some(Frame::Map(map, pending, seen, _)) => match pending.take() {
                Some(key) => js_insert(map, key, value),
                None => {
                    if value.is_string()
                        || value.is_number()
                        || value.is_boolean()
                        || value.is_null()
                    {
                        if seen.contains(&value) {
                            self.error.get_or_insert(("Map keys must be unique", at));
                        }
                        seen.push(value.clone());
                    }
                    *pending = Some(js_key(&value));
                }
            },
        }
    }
}

impl MarkedEventReceiver for Builder {
    fn on_event(&mut self, ev: Event, mark: Marker) {
        let at = mark.index();
        match ev {
            Event::DocumentStart => {
                self.docs += 1;
                if self.docs > 1 {
                    self.error.get_or_insert((
                        "Source contains multiple documents; please use YAML.parseAllDocuments()",
                        at,
                    ));
                }
            }
            Event::Alias(id) => {
                let v = self.anchors.get(&id).cloned().unwrap_or(Value::Null);
                self.push(v, 0, at);
            }
            Event::Scalar(s, style, anchor, tag) => {
                // ponytail: tags other than `!!str` resolve like untagged scalars.
                let is_str = tag
                    .as_ref()
                    .is_some_and(|t| t.handle == "tag:yaml.org,2002:" && t.suffix == "str");
                let v = if style == TScalarStyle::Plain && !is_str {
                    resolve_plain(&s)
                } else {
                    Value::String(s)
                };
                self.push(v, anchor, at);
            }
            Event::SequenceStart(anchor, _) => self.stack.push(Frame::Seq(Vec::new(), anchor)),
            Event::MappingStart(anchor, _) => {
                self.stack
                    .push(Frame::Map(Map::new(), None, Vec::new(), anchor))
            }
            Event::SequenceEnd | Event::MappingEnd => match self.stack.pop() {
                Some(Frame::Seq(items, anchor)) => self.push(Value::Array(items), anchor, at),
                Some(Frame::Map(map, _, _, anchor)) => self.push(Value::Object(map), anchor, at),
                None => {}
            },
            Event::Nothing | Event::StreamStart | Event::StreamEnd | Event::DocumentEnd => {}
        }
    }
}

/// yaml@2 `prettifyError`: the position and a code frame, for the errors raised here.
/// ponytail: columns count chars, where yaml@2 counts UTF-16 units.
fn prettify(src: &str, message: &str, at: usize) -> String {
    let chars: Vec<char> = src.chars().collect();
    let line_start = |i: usize| {
        chars[..i]
            .iter()
            .rposition(|&c| c == '\n')
            .map_or(0, |p| p + 1)
    };
    let start = line_start(at.min(chars.len()));
    let line = chars[..start].iter().filter(|&&c| c == '\n').count() + 1;
    let mut ci = at - start;
    let end = chars[start..]
        .iter()
        .position(|&c| c == '\n')
        .map_or(chars.len(), |p| start + p + 1);
    let mut line_str: String = chars[start..end]
        .iter()
        .collect::<String>()
        .trim_end_matches(['\n', '\r'])
        .to_string();
    let mut out = format!("{message} at line {line}, column {}", ci + 1);
    let len = line_str.chars().count();
    if ci >= 60 && len > 80 {
        let trim_start = (ci - 39).min(len - 79);
        line_str = format!("…{}", line_str.chars().skip(trim_start).collect::<String>());
        ci -= trim_start - 1;
    }
    if line_str.chars().count() > 80 {
        line_str = format!("{}…", line_str.chars().take(79).collect::<String>());
    }
    // The previous line too, when pointing at the start of this one.
    if line > 1 && line_str.chars().take(ci).all(|c| c == ' ') {
        let mut prev: String = chars[line_start(start - 1)..start].iter().collect();
        if prev.chars().count() > 80 {
            prev = format!("{}…\n", prev.chars().take(79).collect::<String>());
        }
        line_str = prev + &line_str;
    }
    if line_str.contains(|c| c != ' ') {
        out += &format!(":\n\n{line_str}\n{}^\n", " ".repeat(ci));
    }
    out
}

/// `YAML.parse(src)`: `Ok(Value::Null)` for an empty document.
pub fn parse(src: &str) -> Result<Value, YamlError> {
    let mut b = Builder::default();
    let mut parser = Parser::new_from_str(src);
    if let Err(e) = parser.load(&mut b, true) {
        if e.info() == "while parsing node, found unknown anchor" {
            // The mark is the alias token (`*name`), in chars.
            let name: String = src
                .chars()
                .skip(e.marker().index() + 1)
                .take_while(|c| !c.is_whitespace() && !",[]{}".contains(*c))
                .collect();
            return Err(YamlError::UnresolvedAlias(name));
        }
        return Err(YamlError::Parse(format!(
            "{} at line {}, column {}",
            e.info(),
            e.marker().line(),
            e.marker().col() + 1
        )));
    }
    if let Some((message, at)) = b.error {
        return Err(YamlError::Parse(prettify(src, message, at)));
    }
    Ok(b.root.unwrap_or(Value::Null))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn yaml() {
        let v = parse("a: 1\nb: [x, 'y', 0o17, 0x1F, -0, 1.5e3, .5, ~, True, '1']\n2: z\nc:\n  - &k {d: e}\n  - *k\n").unwrap();
        assert_eq!(
            v,
            json!({"2": "z", "a": 1, "b": ["x", "y", 15, 31, 0, 1500, 0.5, null, true, "1"], "c": [{"d": "e"}, {"d": "e"}]})
        );
        assert_eq!(
            serde_json::to_string(&v).unwrap(),
            r#"{"2":"z","a":1,"b":["x","y",15,31,0,1500,0.5,null,true,"1"],"c":[{"d":"e"},{"d":"e"}]}"#
        );
        assert_eq!(
            parse("ignore:\n  - *.liquid\n"),
            Err(YamlError::UnresolvedAlias(".liquid".into()))
        );
        assert_eq!(parse("# nothing\n"), Ok(Value::Null));
        assert_eq!(parse("1.2.3"), Ok(json!("1.2.3")));
        assert_eq!(parse("+12"), Ok(json!(12)));
        assert_eq!(parse("1e3"), Ok(json!(1000)));
        assert_eq!(parse("1."), Ok(json!(1)));
        assert_eq!(parse("e3"), Ok(json!("e3")));
        // Expected values from yaml@2.3.1.
        let err = |s| parse(s).unwrap_err().message();
        assert_eq!(
            err("a: {}\na: {}\n"),
            "Map keys must be unique at line 2, column 1:\n\na: {}\na: {}\n^\n"
        );
        assert_eq!(
            err("x:\n  \"k\": 1\n  \"k\": 2\n"),
            "Map keys must be unique at line 3, column 3:\n\n  \"k\": 1\n  \"k\": 2\n  ^\n"
        );
        assert_eq!(
            err("x: {a: 1, a: 2}\n"),
            "Map keys must be unique at line 1, column 11:\n\nx: {a: 1, a: 2}\n          ^\n"
        );
        assert_eq!(
            err("x:\n  - 1\n  - 2\nx: 3\n"),
            "Map keys must be unique at line 4, column 1:\n\n  - 2\nx: 3\n^\n"
        );
        assert_eq!(
            err("a: 1\n...\n---\nb: 2\n"),
            "Source contains multiple documents; please use YAML.parseAllDocuments() at line 3, column 1:\n\n...\n---\n^\n"
        );
        assert_eq!(
            err("a: 1\n---\nb: 2\n"),
            "Source contains multiple documents; please use YAML.parseAllDocuments() at line 2, column 1:\n\na: 1\n---\n^\n"
        );
        assert_eq!(
            err("é: 1\né: 2\n"),
            "Map keys must be unique at line 2, column 1:\n\né: 1\né: 2\n^\n"
        );
    }
}
