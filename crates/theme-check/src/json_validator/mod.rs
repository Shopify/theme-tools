//! theme-check-common `JSONValidator.ts` on a port of vscode-json-languageservice@5.3.10's
//! `doValidation`: `fileMatch` schema associations, `$ref` resolution and JSON Schema validation,
//! with the languageservice's English messages and ranges.
//!
//! TS rejects the validation promise where the languageservice throws (a malformed schema); the
//! `Err` here carries that error's message.

pub mod jsregex;
mod parser;
mod service;
mod url;
mod validate;

use crate::docs::SchemaDefinition;
use crate::json::{array_index, js_number_to_string};
use service::{get, js_string, Obj, SVal, Service};
use std::collections::HashSet;
use std::hash::{BuildHasherDefault, Hasher};
use std::sync::{PoisonError, RwLock};
use validate::{is_draft_2020, RegexCache, VResult, V};

/// An `l10n.t` argument.
pub enum Arg<'a> {
    S(&'a str),
    N(f64),
    /// A schema value, which `l10n.t` treats as its arguments when it's an object or array.
    V(&'a SVal),
}

/// `@vscode/l10n` `t(template, ...args)` without a bundle.
pub(crate) fn t(objs: &[Obj], template: &str, args: &[Arg]) -> Result<String, String> {
    let value = |v: &SVal| (!matches!(v, SVal::Null)).then(|| js_string(v));
    let lookup: Box<dyn Fn(&str) -> Option<String>> = match args.first() {
        None => return Ok(template.into()),
        Some(Arg::V(SVal::Null)) => return Err("Cannot convert undefined or null to object".into()),
        Some(Arg::V(SVal::Arr(a))) if a.is_empty() => return Ok(template.into()),
        Some(Arg::V(SVal::Arr(a))) => {
            Box::new(move |g| a.get(array_index(g)? as usize).and_then(value))
        }
        Some(Arg::V(SVal::Obj(id))) if objs[*id as usize].is_empty() => return Ok(template.into()),
        // ponytail: Object.prototype members aren't values; templates only use `{0}`/`{1}`.
        Some(Arg::V(v @ SVal::Obj(_))) => Box::new(move |g| get(objs, v, g).and_then(value)),
        Some(_) => Box::new(|g| match args.get(array_index(g)? as usize)? {
            Arg::S(s) => Some(s.to_string()),
            Arg::N(n) => Some(js_number_to_string(*n)),
            Arg::V(v) => value(v),
        }),
    };
    // `template.replace(/{([^}]+)}/g, (match, group) => values[group] ?? match)`
    let mut out = String::with_capacity(template.len() + 16);
    let mut rest = template;
    while let Some(i) = rest.find('{') {
        out.push_str(&rest[..i]);
        rest = &rest[i..];
        match rest[1..].find('}').filter(|&j| j > 0) {
            Some(j) => {
                match lookup(&rest[1..j + 1]) {
                    Some(v) => out.push_str(&v),
                    None => out.push_str(&rest[..j + 2]),
                }
                rest = &rest[j + 2..];
            }
            None => {
                out.push('{');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    Ok(out)
}

/// rustc's FxHash for the per-object key maps and sets, where SipHash dominated validating big
/// locale files. Keys come from the theme's own files, so HashDoS isn't a concern.
#[derive(Default)]
pub(crate) struct Fx(u64);

impl Fx {
    fn add(&mut self, word: u64) {
        self.0 = (self.0.rotate_left(5) ^ word).wrapping_mul(0x517c_c1b7_2722_0a95);
    }
}

impl Hasher for Fx {
    fn write(&mut self, bytes: &[u8]) {
        let mut chunks = bytes.chunks_exact(8);
        for c in &mut chunks {
            self.add(u64::from_le_bytes(c.try_into().unwrap()));
        }
        for &b in chunks.remainder() {
            self.add(b as u64);
        }
    }
    fn write_u8(&mut self, i: u8) {
        self.add(i as u64);
    }
    fn write_usize(&mut self, i: usize) {
        self.add(i as u64);
    }
    fn finish(&self) -> u64 {
        self.0
    }
}

pub(crate) type FxBuild = BuildHasherDefault<Fx>;

pub struct Problem {
    pub message: String,
    pub start: usize,
    pub end: usize,
}

pub struct JsonValidator {
    svc: RwLock<Service>,
    regexes: RegexCache,
}

/// `schemaAllowsComments` / `schemaAllowsTrailingCommas`. Their results don't matter with
/// `comments`/`trailingCommas: 'ignore'`, but they can still throw.
fn schema_allows(
    objs: &[Obj],
    schema: &SVal,
    keys: &[&str],
    depth: u32,
) -> Result<Option<bool>, String> {
    let SVal::Obj(_) = schema else {
        return Ok(None);
    };
    if depth > 300 {
        return Err("Maximum call stack size exceeded".into());
    }
    for key in keys {
        if let Some(SVal::Bool(b)) = get(objs, schema, key) {
            return Ok(Some(*b));
        }
    }
    match get(objs, schema, "allOf").filter(|v| v.truthy()) {
        None => Ok(None),
        // A string's characters aren't objects.
        Some(SVal::Str(_)) => Ok(None),
        Some(SVal::Arr(subs)) => {
            for s in subs.iter() {
                if let Some(b) = schema_allows(objs, s, keys, depth + 1)? {
                    return Ok(Some(b));
                }
            }
            Ok(None)
        }
        Some(_) => Err("schemaRef.allOf is not iterable".into()),
    }
}

/// `TextDocument.offsetAt(positionAt(offset))`: in range and not inside a `\r\n`.
fn normalize(text: &str, offset: usize) -> usize {
    let o = offset.min(text.len());
    let b = text.as_bytes();
    if o > 0 && b[o - 1] == b'\r' && b.get(o) == Some(&b'\n') {
        o - 1
    } else {
        o
    }
}

impl JsonValidator {
    pub fn new(defs: &[SchemaDefinition]) -> Self {
        JsonValidator {
            svc: RwLock::new(Service::new(defs)),
            regexes: RwLock::default(),
        }
    }

    /// `validate(uri, jsonString)`: problems with byte offsets into `source`.
    pub fn validate(&self, uri: &str, source: &str) -> Result<Vec<Problem>, String> {
        Ok(self
            .do_validation(uri, source)?
            .into_iter()
            .map(|(p, _)| p)
            .collect())
    }

    /// `isValid(service, uri, jsonString)`: no error-severity problems.
    pub fn is_valid(&self, uri: &str, source: &str) -> Result<bool, String> {
        Ok(self
            .do_validation(uri, source)?
            .iter()
            .all(|(_, error)| !error))
    }

    /// `doValidation` with `{ schemaValidation: 'error', trailingCommas: 'ignore', comments:
    /// 'ignore' }`; each problem with whether its severity is Error.
    fn do_validation(&self, uri: &str, source: &str) -> Result<Vec<(Problem, bool)>, String> {
        let doc = parser::parse(source);
        let root = doc.root.map(|r| (r, doc.node(r)));
        let props: &[u32] = match root {
            Some((
                _,
                parser::Node {
                    kind: parser::Kind::Object(props),
                    ..
                },
            )) => props,
            _ => &[],
        };
        let property = |p: u32| match doc.node(p).kind {
            parser::Kind::Property { key, value } => (doc.str_value(key), value),
            _ => unreachable!(),
        };
        // getSchemaFromProperty
        let schema_prop = props.iter().map(|&p| property(p)).find_map(|(key, value)| {
            match value.map(|v| &doc.node(v).kind) {
                Some(parser::Kind::Str(s)) if key == "$schema" => Some(&**s),
                _ => None,
            }
        });
        let resolved = self
            .svc
            .write()
            .unwrap_or_else(PoisonError::into_inner)
            .schema_for_resource(uri, schema_prop)?;

        let mut out = Vec::new();
        let mut added = HashSet::new();
        let mut add = |start: usize, end: usize, message: String, error: bool| {
            let start = normalize(source, start);
            if added.insert((start, message.clone())) {
                out.push((
                    Problem {
                        message,
                        start,
                        end: normalize(source, end),
                    },
                    error,
                ));
            }
        };
        if let Some(resolved) = resolved {
            let svc = self.svc.read().unwrap_or_else(PoisonError::into_inner);
            let objs = &svc.objs;
            // addSchemaProblem, a Warning.
            let mut schema_problem = |message: &str| {
                let Some((_, r)) = root else { return };
                match props.first().map(|&p| (p, property(p))) {
                    Some((p, ("$schema", value))) => {
                        let n = doc.node(value.unwrap_or(p));
                        add(n.offset, n.offset + n.length, message.into(), false);
                    }
                    _ => add(r.offset, r.offset + 1, message.into(), false),
                }
            };
            if let Some(e) = resolved.errors.first() {
                schema_problem(e);
            } else {
                for w in &resolved.warnings {
                    schema_problem(w);
                }
                if let Some((r, _)) = root {
                    let v = V::new(
                        objs,
                        &doc,
                        is_draft_2020(objs, &resolved.schema),
                        &self.regexes,
                    );
                    let mut result = VResult::default();
                    v.validate(r, &resolved.schema, &mut result)?;
                    for p in result.problems {
                        add(p.offset, p.offset + p.length, p.message, !p.warning);
                    }
                }
            }
            schema_allows(objs, &resolved.schema, &["allowComments"], 0)?;
            schema_allows(
                objs,
                &resolved.schema,
                &["allowTrailingCommas", "allowsTrailingCommas"],
                0,
            )?;
        }
        for e in doc.errors.iter().filter(|e| !e.trailing_comma) {
            add(e.start, e.end, e.message.into(), !e.warning);
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn def(uri: &str, file_match: &[&str], schema: &str) -> SchemaDefinition {
        SchemaDefinition {
            uri: uri.into(),
            file_match: Some(file_match.iter().map(|s| s.to_string()).collect()),
            schema: schema.into(),
        }
    }

    #[test]
    fn l10n() {
        let objs = vec![Vec::new()];
        assert_eq!(
            t(&objs, "a {0} {1} {x}", &[Arg::S("b"), Arg::N(1.5)]).unwrap(),
            "a b 1.5 {x}"
        );
        let arr = SVal::Arr(vec![SVal::Str("x".into()), SVal::Null].into());
        assert_eq!(t(&objs, "{0}{1}", &[Arg::V(&arr)]).unwrap(), "x{1}");
        assert!(t(&objs, "{0}", &[Arg::V(&SVal::Null)]).is_err());
        assert_eq!(t(&objs, "{}{{0}{0}{", &[Arg::S("b")]).unwrap(), "{}{{0}b{");
    }

    #[test]
    fn validates() {
        let schema = r##"{"type":"object","properties":{"a":{"type":"string","enum":["x","y"]},"b":{"$ref":"#/definitions/n"}},
            "required":["c"],"additionalProperties":false,"definitions":{"n":{"type":"integer","minimum":2}}}"##;
        let v = JsonValidator::new(&[def("https://x/s.json", &["*.json"], schema)]);
        let src = "{\"a\": \"z\", \"b\": 1.5, \"d\": 1, \"d\": 2}";
        let messages: Vec<String> = v
            .validate("file:///t/f.json", src)
            .unwrap()
            .into_iter()
            .map(|p| p.message)
            .collect();
        assert_eq!(
            messages,
            [
                "Missing property \"c\".",
                "Value is not accepted. Valid values: \"x\", \"y\".",
                "Incorrect type. Expected \"integer\".",
                "Value is below the minimum of 2.",
                "Property d is not allowed.",
                "Duplicate object key",
                "Duplicate object key",
            ]
        );
        assert!(!v.is_valid("file:///t/f.json", src).unwrap());
        assert!(v.is_valid("file:///t/f.txt", src).unwrap());
    }
}
