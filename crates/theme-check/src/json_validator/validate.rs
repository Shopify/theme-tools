//! vscode-json-languageservice `parser/jsonParser.js` `validate`: a document against a resolved
//! schema. doValidation passes `NoOpSchemaCollector`, so matching schemas aren't collected.

use super::jsregex::{compile, extended_regexp, JsRegex};
use super::parser::{Doc, Kind, Node};
use super::service::{get, js_join, js_string, stringify, Obj, SVal, EMPTY, FALSE_SCHEMA, ONE};
use super::{t, Arg, FxBuild};
use crate::js::{len16, string_to_number};
use crate::json::js_number_to_string;
use regex::Regex;
use std::borrow::Cow;
use std::cell::Cell;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock, PoisonError, RwLock};

/// Compiled `pattern`/`patternProperties` regexes, shared so their match caches are too.
pub type RegexCache = RwLock<HashMap<Box<str>, Arc<JsRegex>, FxBuild>>;

/// Nested `validate` calls before giving up the way V8 does on a self-referencing schema
/// (`allOf: [{ $ref: '#' }]`). A level takes up to ~2.5KB of the 2MB check threads' stack.
/// ponytail: V8 gets through ~3000 levels, so documents nested 300-3000 deep throw here only.
const MAX_DEPTH: u32 = 300;

pub struct Prob {
    pub offset: usize,
    pub length: usize,
    pub message: String,
    /// `ErrorCode.EnumValueMismatch`, whose message `mergeEnumValues` rewrites.
    enum_mismatch: bool,
    /// `DiagnosticSeverity.Warning` (deprecations); others take doValidation's Error.
    pub warning: bool,
}

/// `ValidationResult.enumValues`
enum Vals<'a> {
    Slice(&'a [SVal]),
    Many(Vec<&'a SVal>),
}

impl<'a> Vals<'a> {
    fn to_vec(&self) -> Vec<&'a SVal> {
        match self {
            Vals::Slice(s) => s.iter().collect(),
            Vals::Many(v) => v.clone(),
        }
    }

    fn len(&self) -> usize {
        match self {
            Vals::Slice(s) => s.len(),
            Vals::Many(v) => v.len(),
        }
    }
}

/// `ValidationResult`
#[derive(Default)]
pub struct VResult<'a> {
    pub problems: Vec<Prob>,
    pm: u32,
    pvm: u32,
    primary: u32,
    processed: HashSet<Cow<'a, str>, FxBuild>,
    enum_match: bool,
    enum_values: Option<Vals<'a>>,
}

impl<'a> VResult<'a> {
    fn merge(&mut self, other: VResult<'a>) {
        self.problems.extend(other.problems);
        self.pm += other.pm;
        self.pvm += other.pvm;
        self.processed.extend(other.processed);
    }

    fn merge_enum_values(&mut self, objs: &[Obj], other: &VResult<'a>) -> Result<(), String> {
        if let (false, false, Some(mine), Some(theirs)) = (
            self.enum_match,
            other.enum_match,
            &self.enum_values,
            &other.enum_values,
        ) {
            let mut all = mine.to_vec();
            all.extend(theirs.to_vec());
            let list: Vec<String> = all.iter().map(|v| stringify(objs, v)).collect();
            self.enum_values = Some(Vals::Many(all));
            for p in self.problems.iter_mut().filter(|p| p.enum_mismatch) {
                p.message = t(
                    objs,
                    "Value is not accepted. Valid values: {0}.",
                    &[Arg::S(&list.join(", "))],
                )?;
            }
        }
        Ok(())
    }

    fn merge_property_match(&mut self, other: VResult<'a>) {
        self.pm += 1;
        if other.enum_match || (other.problems.is_empty() && other.pm != 0) {
            self.pvm += 1;
        }
        if other.enum_match && other.enum_values.as_ref().is_some_and(|v| v.len() == 1) {
            self.primary += 1;
        }
        self.problems.extend(other.problems);
    }

    fn compare(&self, other: &VResult) -> i64 {
        let has = !self.problems.is_empty();
        if has != !other.problems.is_empty() {
            return if has { -1 } else { 1 };
        }
        if self.enum_match != other.enum_match {
            return if other.enum_match { -1 } else { 1 };
        }
        if self.primary != other.primary {
            return self.primary as i64 - other.primary as i64;
        }
        if self.pvm != other.pvm {
            return self.pvm as i64 - other.pvm as i64;
        }
        self.pm as i64 - other.pm as i64
    }
}

/// The keywords `validate` reads, from one pass over the schema's own keys. Non-objects have
/// none, so they validate like `{}`.
#[derive(Default)]
struct Kw<'a> {
    type_: Option<&'a SVal>,
    all_of: Option<&'a SVal>,
    not: Option<&'a SVal>,
    any_of: Option<&'a SVal>,
    one_of: Option<&'a SVal>,
    if_: Option<&'a SVal>,
    then: Option<&'a SVal>,
    else_: Option<&'a SVal>,
    enum_: Option<&'a SVal>,
    const_: Option<&'a SVal>,
    deprecation_message: Option<&'a SVal>,
    deprecated: Option<&'a SVal>,
    error_message: Option<&'a SVal>,
    pattern_error_message: Option<&'a SVal>,
    multiple_of: Option<&'a SVal>,
    minimum: Option<&'a SVal>,
    maximum: Option<&'a SVal>,
    exclusive_minimum: Option<&'a SVal>,
    exclusive_maximum: Option<&'a SVal>,
    min_length: Option<&'a SVal>,
    max_length: Option<&'a SVal>,
    pattern: Option<&'a SVal>,
    format: Option<&'a SVal>,
    prefix_items: Option<&'a SVal>,
    items: Option<&'a SVal>,
    additional_items: Option<&'a SVal>,
    contains: Option<&'a SVal>,
    min_contains: Option<&'a SVal>,
    max_contains: Option<&'a SVal>,
    unevaluated_items: Option<&'a SVal>,
    min_items: Option<&'a SVal>,
    max_items: Option<&'a SVal>,
    unique_items: Option<&'a SVal>,
    required: Option<&'a SVal>,
    properties: Option<&'a SVal>,
    pattern_properties: Option<&'a SVal>,
    additional_properties: Option<&'a SVal>,
    unevaluated_properties: Option<&'a SVal>,
    max_properties: Option<&'a SVal>,
    min_properties: Option<&'a SVal>,
    dependent_required: Option<&'a SVal>,
    dependent_schemas: Option<&'a SVal>,
    dependencies: Option<&'a SVal>,
    property_names: Option<&'a SVal>,
}

impl<'a> Kw<'a> {
    fn of(objs: &'a [Obj], schema: &'a SVal) -> Self {
        let mut k = Kw::default();
        let SVal::Obj(id) = schema else { return k };
        for (key, v) in &objs[*id as usize] {
            let slot = match &**key {
                "type" => &mut k.type_,
                "allOf" => &mut k.all_of,
                "not" => &mut k.not,
                "anyOf" => &mut k.any_of,
                "oneOf" => &mut k.one_of,
                "if" => &mut k.if_,
                "then" => &mut k.then,
                "else" => &mut k.else_,
                "enum" => &mut k.enum_,
                "const" => &mut k.const_,
                "deprecationMessage" => &mut k.deprecation_message,
                "deprecated" => &mut k.deprecated,
                "errorMessage" => &mut k.error_message,
                "patternErrorMessage" => &mut k.pattern_error_message,
                "multipleOf" => &mut k.multiple_of,
                "minimum" => &mut k.minimum,
                "maximum" => &mut k.maximum,
                "exclusiveMinimum" => &mut k.exclusive_minimum,
                "exclusiveMaximum" => &mut k.exclusive_maximum,
                "minLength" => &mut k.min_length,
                "maxLength" => &mut k.max_length,
                "pattern" => &mut k.pattern,
                "format" => &mut k.format,
                "prefixItems" => &mut k.prefix_items,
                "items" => &mut k.items,
                "additionalItems" => &mut k.additional_items,
                "contains" => &mut k.contains,
                "minContains" => &mut k.min_contains,
                "maxContains" => &mut k.max_contains,
                "unevaluatedItems" => &mut k.unevaluated_items,
                "minItems" => &mut k.min_items,
                "maxItems" => &mut k.max_items,
                "uniqueItems" => &mut k.unique_items,
                "required" => &mut k.required,
                "properties" => &mut k.properties,
                "patternProperties" => &mut k.pattern_properties,
                "additionalProperties" => &mut k.additional_properties,
                "unevaluatedProperties" => &mut k.unevaluated_properties,
                "maxProperties" => &mut k.max_properties,
                "minProperties" => &mut k.min_properties,
                "dependentRequired" => &mut k.dependent_required,
                "dependentSchemas" => &mut k.dependent_schemas,
                "dependencies" => &mut k.dependencies,
                "propertyNames" => &mut k.property_names,
                _ => continue,
            };
            *slot = Some(v);
        }
        k
    }
}

fn as_schema(v: &SVal) -> &SVal {
    match v {
        SVal::Bool(true) => &EMPTY,
        SVal::Bool(false) => &FALSE_SCHEMA,
        v => v,
    }
}

fn truthy(v: Option<&SVal>) -> bool {
    v.is_some_and(SVal::truthy)
}

fn num(v: Option<&SVal>) -> Option<f64> {
    v.and_then(SVal::num)
}

/// `a || b || default`. ponytail: a non-string message is coerced; TS passes it through as is.
fn message(
    first: &[Option<&SVal>],
    default: impl FnOnce() -> Result<String, String>,
) -> Result<String, String> {
    match first.iter().flatten().find(|v| v.truthy()) {
        Some(v) => Ok(js_string(v)),
        None => default(),
    }
}

/// `getSchemaDraft(schema) >= SchemaDraft.v2020_12`
pub fn is_draft_2020(objs: &[Obj], schema: &SVal) -> bool {
    match get(objs, schema, "$schema").filter(|v| v.truthy()) {
        None => true,
        Some(id) => !matches!(
            js_string(id).as_str(),
            "http://json-schema.org/draft-03/schema#"
                | "http://json-schema.org/draft-04/schema#"
                | "http://json-schema.org/draft-06/schema#"
                | "http://json-schema.org/draft-07/schema#"
                | "https://json-schema.org/draft/2019-09/schema"
                // `schemaDraftFromId[id]` finds Object.prototype members, which compare false.
                | "constructor"
                | "__proto__"
                | "__defineGetter__"
                | "__defineSetter__"
                | "__lookupGetter__"
                | "__lookupSetter__"
                | "hasOwnProperty"
                | "isPrototypeOf"
                | "propertyIsEnumerable"
                | "toString"
                | "toLocaleString"
                | "valueOf"
        ),
    }
}

struct Format {
    message: &'static str,
    re: Regex,
}

/// `formats`, with JS's `\d` as `[0-9]` and the `i` flag spelled out in ASCII classes (Rust's
/// case folding would also match `K` (Kelvin) for `k`).
static FORMATS: LazyLock<HashMap<&'static str, Format>> = LazyLock::new(|| {
    const IPV6: &str = r"^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$";
    const EMAIL: &str = r#"^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}))$"#;
    let ipv6 = IPV6
        .replace(r"\d", "[0-9]")
        .replace("[0-9a-f]", "[0-9a-fA-F]");
    let JsRegex::Re(email) = compile(EMAIL, false) else {
        unreachable!()
    };
    let re = |s: &str| Regex::new(s).unwrap();
    [
        ("color-hex", "Invalid color format. Use #RGB, #RGBA, #RRGGBB or #RRGGBBAA.", re(r"^#([0-9A-Fa-f]{3,4}|([0-9A-Fa-f]{2}){3,4})$")),
        (
            "date-time",
            "String is not a RFC3339 date-time.",
            re(r"^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])[Tt]([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?([Zz]|(\+|-)([01][0-9]|2[0-3]):([0-5][0-9]))$"),
        ),
        ("date", "String is not a RFC3339 date.", re(r"^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$")),
        (
            "time",
            "String is not a RFC3339 time.",
            re(r"^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?([Zz]|(\+|-)([01][0-9]|2[0-3]):([0-5][0-9]))$"),
        ),
        ("email", "String is not an e-mail address.", email),
        // The `(?=.{1,253}\.?$)` lookahead is the length check in `format_matches`.
        (
            "hostname",
            "String is not a hostname.",
            re(r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$"),
        ),
        (
            "ipv4",
            "String is not an IPv4 address.",
            re(r"^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$"),
        ),
        ("ipv6", "String is not an IPv6 address.", re(&ipv6)),
    ]
    .into_iter()
    .map(|(name, message, re)| (name, Format { message, re }))
    .collect()
});

fn format_matches(name: &str, f: &Format, s: &str) -> bool {
    f.re.is_match(s)
        && (name != "hostname" || s.len() <= 253 || (s.len() == 254 && s.ends_with('.')))
}

/// `/^(([^:/?#]+?):)?.../.exec(s)[2]`: a scheme before any of `/?#`.
fn has_uri_scheme(s: &str) -> bool {
    s.find([':', '/', '?', '#'])
        .is_some_and(|i| i > 0 && s.as_bytes()[i] == b':')
}

/// normalizeFloats: `{ value, multiplier }` from the number's JS string.
fn normalize_floats(f: f64) -> Option<(f64, i32)> {
    let s = js_number_to_string(f);
    let digits = |d: &str| !d.is_empty() && d.bytes().all(|b| b.is_ascii_digit());
    let (mantissa, exp) = match s.split_once('e') {
        Some((m, e)) => {
            let sign = e.chars().next().filter(|c| matches!(c, '+' | '-'))?;
            let n: i32 = e[1..].parse().ok().filter(|_| digits(&e[1..]))?;
            (m, if sign == '-' { -n } else { n })
        }
        None => (s.as_str(), 0),
    };
    let (int, frac) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    if !digits(int.strip_prefix('-').unwrap_or(int)) || (mantissa.contains('.') && !digits(frac)) {
        return None;
    }
    Some((
        format!("{int}{frac}").parse().ok()?,
        frac.len() as i32 - exp,
    ))
}

#[derive(Clone, Copy)]
enum J<'a> {
    Doc(u32),
    Schema(&'a SVal),
}

/// A value's shape for `equals`; objects as unique keys (a document object's last property
/// with a value wins, like `getNodeValue`).
enum P<'a> {
    Null,
    Bool(bool),
    Num(f64),
    Str(&'a str),
    Arr(Vec<J<'a>>),
    Obj(Vec<(&'a str, J<'a>)>),
}

pub struct V<'a> {
    objs: &'a [Obj],
    doc: &'a Doc<'a>,
    draft2020: bool,
    regexes: &'a RegexCache,
    depth: Cell<u32>,
}

impl<'a> V<'a> {
    pub fn new(
        objs: &'a [Obj],
        doc: &'a Doc<'a>,
        draft2020: bool,
        regexes: &'a RegexCache,
    ) -> Self {
        V {
            objs,
            doc,
            draft2020,
            regexes,
            depth: Cell::new(0),
        }
    }

    fn node(&self, id: u32) -> &'a Node<'a> {
        self.doc.node(id)
    }

    fn push(&self, r: &mut VResult, node: u32, message: String) {
        let n = self.node(node);
        r.problems.push(Prob {
            offset: n.offset,
            length: n.length,
            message,
            enum_mismatch: false,
            warning: false,
        });
    }

    /// The key of the property holding value `child`.
    fn push_at_key(&self, r: &mut VResult, child: u32, message: String) {
        let key = match self.node(child).parent.map(|p| &self.node(p).kind) {
            Some(Kind::Property { key, .. }) => *key,
            _ => child,
        };
        self.push(r, key, message);
    }

    fn regex(&self, pattern: &str) -> Arc<JsRegex> {
        if let Some(re) = self
            .regexes
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .get(pattern)
        {
            return re.clone();
        }
        let re = Arc::new(extended_regexp(pattern));
        self.regexes
            .write()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(pattern.into(), re.clone());
        re
    }

    /// `Object.keys(v)` / `for (k in v)` with `v[k]`.
    fn entries(&self, v: &'a SVal) -> Vec<(Cow<'a, str>, &'a SVal)> {
        match v {
            SVal::Obj(id) => self.objs[*id as usize]
                .iter()
                .map(|(k, v)| (Cow::Borrowed(&**k), v))
                .collect(),
            SVal::Arr(a) => a
                .iter()
                .enumerate()
                .map(|(i, v)| (Cow::Owned(i.to_string()), v))
                .collect(),
            SVal::Str(s) => (0..len16(s))
                .map(|i| (Cow::Owned(i.to_string()), &ONE))
                .collect(),
            _ => Vec::new(),
        }
    }

    pub fn validate(&self, n: u32, schema: &'a SVal, r: &mut VResult<'a>) -> Result<(), String> {
        let node = match self.node(n).kind {
            Kind::Property { value: Some(v), .. } => v,
            Kind::Property { value: None, .. } => return Ok(()),
            _ => n,
        };
        if let SVal::Null = schema {
            return Err("Cannot read properties of null (reading 'type')".into());
        }
        let depth = self.depth.get();
        if depth > MAX_DEPTH {
            return Err("Maximum call stack size exceeded".into());
        }
        self.depth.set(depth + 1);
        let k = Kw::of(self.objs, schema);
        let result = self
            .validate_node(node, &k, r)
            .and_then(|_| match &self.node(node).kind {
                Kind::Object(props) => self.validate_object(node, props, &k, r),
                Kind::Array(items) => self.validate_array(node, items, &k, r),
                Kind::Str(s) => self.validate_string(node, s, &k, r),
                Kind::Num { value, .. } => self.validate_number(node, *value, &k, r),
                _ => Ok(()),
            });
        self.depth.set(depth);
        result
    }

    fn matches_type(&self, node: u32, ty: &SVal) -> bool {
        let SVal::Str(ty) = ty else { return false };
        **ty == *self.doc.type_name(node)
            || (&**ty == "integer"
                && matches!(
                    self.node(node).kind,
                    Kind::Num {
                        is_integer: true,
                        ..
                    }
                ))
    }

    fn validate_node(&self, node: u32, k: &Kw<'a>, r: &mut VResult<'a>) -> Result<(), String> {
        let objs = self.objs;
        match k.type_ {
            Some(SVal::Arr(types)) => {
                if !types.iter().any(|ty| self.matches_type(node, ty)) {
                    let m = message(&[k.error_message], || {
                        t(
                            objs,
                            "Incorrect type. Expected one of {0}.",
                            &[Arg::S(&js_join(types, ", "))],
                        )
                    })?;
                    self.push(r, node, m);
                }
            }
            Some(ty) if ty.truthy() => {
                if !self.matches_type(node, ty) {
                    let m = message(&[k.error_message], || {
                        t(objs, "Incorrect type. Expected \"{0}\".", &[Arg::V(ty)])
                    })?;
                    self.push(r, node, m);
                }
            }
            _ => {}
        }
        if let Some(SVal::Arr(subs)) = k.all_of {
            for s in subs.iter() {
                let mut sub = VResult::default();
                self.validate(node, as_schema(s), &mut sub)?;
                r.merge(sub);
            }
        }
        if let Some(not) = k.not.map(as_schema).filter(|s| s.truthy()) {
            let mut sub = VResult::default();
            self.validate(node, not, &mut sub)?;
            if sub.problems.is_empty() {
                let m = message(&[k.error_message], || {
                    Ok("Matches a schema that is not allowed.".into())
                })?;
                self.push(r, node, m);
            }
        }
        if let Some(SVal::Arr(alternatives)) = k.any_of {
            self.test_alternatives(node, alternatives, false, r)?;
        }
        if let Some(SVal::Arr(alternatives)) = k.one_of {
            self.test_alternatives(node, alternatives, true, r)?;
        }
        if let Some(if_) = k.if_.map(as_schema).filter(|s| s.truthy()) {
            let mut sub = VResult::default();
            self.validate(node, if_, &mut sub)?;
            r.processed.extend(sub.processed.drain());
            let branch = if sub.problems.is_empty() {
                k.then
            } else {
                k.else_
            };
            if let Some(branch) = branch.map(as_schema).filter(|s| s.truthy()) {
                let mut sub = VResult::default();
                self.validate(node, branch, &mut sub)?;
                r.merge(sub);
            }
        }
        if let Some(SVal::Arr(values)) = k.enum_ {
            let matched = values
                .iter()
                .any(|e| self.equals(J::Doc(node), J::Schema(e)));
            r.enum_values = Some(Vals::Slice(values));
            r.enum_match = matched;
            if !matched {
                let m = message(&[k.error_message], || {
                    let list: Vec<String> = values.iter().map(|v| stringify(objs, v)).collect();
                    t(
                        objs,
                        "Value is not accepted. Valid values: {0}.",
                        &[Arg::S(&list.join(", "))],
                    )
                })?;
                self.push(r, node, m);
                r.problems.last_mut().unwrap().enum_mismatch = true;
            }
        }
        if let Some(c) = k.const_ {
            r.enum_match = self.equals(J::Doc(node), J::Schema(c));
            if !r.enum_match {
                let m = message(&[k.error_message], || {
                    t(objs, "Value must be {0}.", &[Arg::S(&stringify(objs, c))])
                })?;
                self.push(r, node, m);
                r.problems.last_mut().unwrap().enum_mismatch = true;
            }
            r.enum_values = Some(Vals::Slice(std::slice::from_ref(c)));
        }
        if truthy(k.deprecation_message) || truthy(k.deprecated) {
            let m = message(
                &[k.deprecation_message],
                || Ok("Value is deprecated".into()),
            )?;
            let target = match self.node(node).parent {
                Some(p) if matches!(self.node(p).kind, Kind::Property { .. }) => p,
                _ => node,
            };
            self.push(r, target, m);
            r.problems.last_mut().unwrap().warning = true;
        }
        Ok(())
    }

    fn test_alternatives(
        &self,
        node: u32,
        alternatives: &'a [SVal],
        max_one_match: bool,
        r: &mut VResult<'a>,
    ) -> Result<(), String> {
        let mut matches = 0;
        let mut best: Option<VResult<'a>> = None;
        for s in alternatives {
            let mut sub = VResult::default();
            self.validate(node, as_schema(s), &mut sub)?;
            if sub.problems.is_empty() {
                matches += 1;
            }
            match &mut best {
                None => best = Some(sub),
                Some(b) if !max_one_match && sub.problems.is_empty() && b.problems.is_empty() => {
                    b.pm += sub.pm;
                    b.pvm += sub.pvm;
                    b.processed.extend(sub.processed);
                }
                Some(b) => match sub.compare(b) {
                    c if c > 0 => *b = sub,
                    0 => b.merge_enum_values(self.objs, &sub)?,
                    _ => {}
                },
            }
        }
        if matches > 1 && max_one_match {
            let offset = self.node(node).offset;
            let message = "Matches multiple schemas when only one must validate.".into();
            r.problems.push(Prob {
                offset,
                length: 1,
                message,
                enum_mismatch: false,
                warning: false,
            });
        }
        if let Some(b) = best {
            r.merge(b);
        }
        Ok(())
    }

    fn validate_number(
        &self,
        node: u32,
        val: f64,
        k: &Kw<'a>,
        r: &mut VResult<'a>,
    ) -> Result<(), String> {
        let objs = self.objs;
        if let Some(m) = num(k.multiple_of) {
            let mut remainder = -1.0;
            if m.is_finite() && m.trunc() == m {
                remainder = val % m;
            } else if let (Some(mut nm), Some(mut nv)) =
                (normalize_floats(m), normalize_floats(val))
            {
                let multiplier = 10f64.powf((nv.1 - nm.1).abs() as f64);
                if nv.1 < nm.1 {
                    nv.0 *= multiplier;
                } else {
                    nm.0 *= multiplier;
                }
                remainder = nv.0 % nm.0;
            }
            if remainder != 0.0 {
                self.push(
                    r,
                    node,
                    t(objs, "Value is not divisible by {0}.", &[Arg::N(m)])?,
                );
            }
        }
        let exclusive_limit = |limit: Option<&SVal>, exclusive: Option<&SVal>| match exclusive {
            Some(SVal::Num(e)) => Some(*e),
            Some(SVal::Bool(true)) => num(limit),
            _ => None,
        };
        let limit = |limit: Option<&SVal>, exclusive: Option<&SVal>| match exclusive {
            Some(SVal::Bool(true)) => None,
            _ => num(limit),
        };
        if let Some(b) = exclusive_limit(k.minimum, k.exclusive_minimum).filter(|b| val <= *b) {
            self.push(
                r,
                node,
                t(
                    objs,
                    "Value is below the exclusive minimum of {0}.",
                    &[Arg::N(b)],
                )?,
            );
        }
        if let Some(b) = exclusive_limit(k.maximum, k.exclusive_maximum).filter(|b| val >= *b) {
            self.push(
                r,
                node,
                t(
                    objs,
                    "Value is above the exclusive maximum of {0}.",
                    &[Arg::N(b)],
                )?,
            );
        }
        if let Some(b) = limit(k.minimum, k.exclusive_minimum).filter(|b| val < *b) {
            self.push(
                r,
                node,
                t(objs, "Value is below the minimum of {0}.", &[Arg::N(b)])?,
            );
        }
        if let Some(b) = limit(k.maximum, k.exclusive_maximum).filter(|b| val > *b) {
            self.push(
                r,
                node,
                t(objs, "Value is above the maximum of {0}.", &[Arg::N(b)])?,
            );
        }
        Ok(())
    }

    fn validate_string(
        &self,
        node: u32,
        s: &str,
        k: &Kw<'a>,
        r: &mut VResult<'a>,
    ) -> Result<(), String> {
        let objs = self.objs;
        // ponytail: stringLength counts code points; a lone surrogate (U+FFFD here) counts once.
        if let Some(m) = num(k.min_length) {
            if (s.chars().count() as f64) < m {
                self.push(
                    r,
                    node,
                    t(
                        objs,
                        "String is shorter than the minimum length of {0}.",
                        &[Arg::N(m)],
                    )?,
                );
            }
        }
        if let Some(m) = num(k.max_length) {
            if (s.chars().count() as f64) > m {
                self.push(
                    r,
                    node,
                    t(
                        objs,
                        "String is longer than the maximum length of {0}.",
                        &[Arg::N(m)],
                    )?,
                );
            }
        }
        if let Some(SVal::Str(pattern)) = k.pattern {
            let fails = match &*self.regex(pattern) {
                JsRegex::Re(re) => !re.is_match(s),
                // `regex?.test(...)` on `undefined`.
                JsRegex::Invalid => true,
                // ponytail: lookaround and backreferences aren't checked.
                JsRegex::Unsupported => false,
            };
            if fails {
                let m = message(&[k.pattern_error_message, k.error_message], || {
                    t(
                        objs,
                        "String does not match the pattern of \"{0}\".",
                        &[Arg::S(pattern)],
                    )
                })?;
                self.push(r, node, m);
            }
        }
        if let Some(SVal::Str(format)) = k.format {
            match &**format {
                "uri" | "uri-reference" => {
                    let error = if s.is_empty() {
                        Some("URI expected.")
                    } else if &**format == "uri" && !has_uri_scheme(s) {
                        Some("URI with a scheme is expected.")
                    } else {
                        None
                    };
                    if let Some(e) = error {
                        let m = message(&[k.pattern_error_message, k.error_message], || {
                            t(objs, "String is not a URI: {0}", &[Arg::S(e)])
                        })?;
                        self.push(r, node, m);
                    }
                }
                name => {
                    if let Some(f) = FORMATS.get(name) {
                        if s.is_empty() || !format_matches(name, f, s) {
                            let m = message(&[k.pattern_error_message, k.error_message], || {
                                Ok(f.message.into())
                            })?;
                            self.push(r, node, m);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn validate_array(
        &self,
        node: u32,
        items: &'a [u32],
        k: &Kw<'a>,
        r: &mut VResult<'a>,
    ) -> Result<(), String> {
        let objs = self.objs;
        let items_is_array = matches!(k.items, Some(SVal::Arr(_)));
        let (prefix, additional) = match (self.draft2020, items_is_array) {
            (true, true) => (k.prefix_items, None),
            (true, false) => (k.prefix_items, k.items),
            (false, true) => (k.items, k.additional_items),
            (false, false) => (None, k.items),
        };
        let mut index = 0;
        if let Some(prefix) = prefix {
            // `prefixItems.length`, compared as a number; an object is array-like.
            let len = match prefix {
                SVal::Null => {
                    return Err("Cannot read properties of null (reading 'length')".into())
                }
                SVal::Arr(a) => a.len() as f64,
                SVal::Str(s) => len16(s) as f64,
                SVal::Obj(_) => match get(objs, prefix, "length") {
                    Some(SVal::Num(n)) => *n,
                    Some(SVal::Bool(b)) => *b as u8 as f64,
                    Some(SVal::Null) => 0.0,
                    Some(SVal::Str(s)) => string_to_number(s),
                    Some(SVal::Arr(a)) => string_to_number(&js_join(a, ",")),
                    _ => f64::NAN,
                },
                _ => f64::NAN,
            };
            while (index as f64) < len && index < items.len() {
                let sub = match prefix {
                    SVal::Arr(a) => as_schema(&a[index]),
                    SVal::Obj(_) => match get(objs, prefix, &index.to_string()) {
                        Some(v) => as_schema(v),
                        None => {
                            return Err(
                                "Cannot read properties of undefined (reading 'type')".into()
                            )
                        }
                    },
                    _ => &ONE,
                };
                let mut item = VResult::default();
                self.validate(items[index], sub, &mut item)?;
                r.merge_property_match(item);
                r.processed.insert(Cow::Owned(index.to_string()));
                index += 1;
            }
        }
        if let Some(additional) = additional.filter(|_| index < items.len()) {
            if let SVal::Bool(allowed) = additional {
                if !allowed {
                    let m = t(
                        objs,
                        "Array has too many items according to schema. Expected {0} or fewer.",
                        &[Arg::N(index as f64)],
                    )?;
                    self.push(r, node, m);
                }
                for i in index..items.len() {
                    r.processed.insert(Cow::Owned(i.to_string()));
                    r.pvm += 1;
                }
            } else {
                for (i, &item) in items.iter().enumerate().skip(index) {
                    let mut ir = VResult::default();
                    self.validate(item, additional, &mut ir)?;
                    r.merge_property_match(ir);
                    r.processed.insert(Cow::Owned(i.to_string()));
                }
            }
        }
        if let Some(contains) = k.contains.map(as_schema).filter(|s| s.truthy()) {
            let mut count = 0;
            for (i, &item) in items.iter().enumerate() {
                let mut ir = VResult::default();
                self.validate(item, contains, &mut ir)?;
                if ir.problems.is_empty() {
                    count += 1;
                    if self.draft2020 {
                        r.processed.insert(Cow::Owned(i.to_string()));
                    }
                }
            }
            let min = num(k.min_contains);
            if count == 0 && min.is_none() {
                let m = message(&[k.error_message], || {
                    Ok("Array does not contain required item.".into())
                })?;
                self.push(r, node, m);
            }
            if let Some(min) = min.filter(|m| (count as f64) < *m) {
                let m = t(objs, "Array has too few items that match the contains contraint. Expected {0} or more.", &[Arg::N(min)])?;
                self.push(r, node, m);
            }
            if let Some(max) = num(k.max_contains).filter(|m| (count as f64) > *m) {
                let m = t(objs, "Array has too many items that match the contains contraint. Expected {0} or less.", &[Arg::N(max)])?;
                self.push(r, node, m);
            }
        }
        if let Some(unevaluated) = k.unevaluated_items {
            for (i, &item) in items.iter().enumerate() {
                let key = i.to_string();
                if !r.processed.contains(key.as_str()) {
                    if let SVal::Bool(false) = unevaluated {
                        self.push(
                            r,
                            node,
                            "Item does not match any validation rule from the array.".into(),
                        );
                    } else {
                        let mut ir = VResult::default();
                        self.validate(item, unevaluated, &mut ir)?;
                        r.merge_property_match(ir);
                    }
                }
                r.processed.insert(Cow::Owned(key));
                r.pvm += 1;
            }
        }
        if let Some(min) = num(k.min_items).filter(|m| (items.len() as f64) < *m) {
            self.push(
                r,
                node,
                t(
                    objs,
                    "Array has too few items. Expected {0} or more.",
                    &[Arg::N(min)],
                )?,
            );
        }
        if let Some(max) = num(k.max_items).filter(|m| (items.len() as f64) > *m) {
            self.push(
                r,
                node,
                t(
                    objs,
                    "Array has too many items. Expected {0} or fewer.",
                    &[Arg::N(max)],
                )?,
            );
        }
        if let Some(SVal::Bool(true)) = k.unique_items {
            let dup = (0..items.len()).any(|i| {
                (i + 1..items.len()).any(|j| self.equals(J::Doc(items[i]), J::Doc(items[j])))
            });
            if dup {
                self.push(r, node, "Array has duplicate items.".into());
            }
        }
        Ok(())
    }

    fn validate_object(
        &self,
        node: u32,
        props: &'a [u32],
        k: &Kw<'a>,
        r: &mut VResult<'a>,
    ) -> Result<(), String> {
        let objs = self.objs;
        // `seenKeys` (the last property's value wins) and `unprocessedProperties` (first-seen
        // order, `live` = still in the set).
        let mut seen: HashMap<&'a str, (Option<u32>, usize), FxBuild> =
            HashMap::with_capacity_and_hasher(props.len(), FxBuild::default());
        let mut order: Vec<&'a str> = Vec::with_capacity(props.len());
        for &p in props {
            let Kind::Property { key, value } = self.node(p).kind else {
                continue;
            };
            let name = self.doc.str_value(key);
            match seen.get_mut(name) {
                Some(e) => e.0 = value,
                None => {
                    seen.insert(name, (value, order.len()));
                    order.push(name);
                }
            }
        }
        let mut live = vec![true; order.len()];
        let child = |name: &str| seen.get(name).and_then(|e| e.0);
        let processed = |name: Cow<'a, str>, live: &mut [bool], r: &mut VResult<'a>| {
            if let Some(e) = seen.get(&*name) {
                live[e.1] = false;
            }
            r.processed.insert(name);
        };
        let not_allowed = |r: &mut VResult<'a>, child: u32, name: &str| -> Result<(), String> {
            let m = message(&[k.error_message], || {
                t(objs, "Property {0} is not allowed.", &[Arg::S(name)])
            })?;
            self.push_at_key(r, child, m);
            Ok(())
        };
        // A property's value against a `properties`-like schema (booleans aren't asSchema'd).
        let property =
            |r: &mut VResult<'a>, child: u32, name: &str, schema: &'a SVal| -> Result<(), String> {
                match schema {
                    SVal::Bool(false) => not_allowed(r, child, name)?,
                    SVal::Bool(true) => {
                        r.pm += 1;
                        r.pvm += 1;
                    }
                    _ => {
                        let mut pr = VResult::default();
                        self.validate(child, schema, &mut pr)?;
                        r.merge_property_match(pr);
                    }
                }
                Ok(())
            };

        if let Some(SVal::Arr(required)) = k.required {
            for p in required.iter() {
                let name = match p {
                    SVal::Str(s) => Cow::Borrowed(&**s),
                    v => Cow::Owned(js_string(v)),
                };
                if child(&name).is_none() {
                    let n = self.node(node);
                    let (offset, length) = match n.parent.map(|p| &self.node(p).kind) {
                        Some(Kind::Property { key, .. }) => {
                            (self.node(*key).offset, self.node(*key).length)
                        }
                        _ => (n.offset, 1),
                    };
                    let message = t(objs, "Missing property \"{0}\".", &[Arg::V(p)])?;
                    r.problems.push(Prob {
                        offset,
                        length,
                        message,
                        enum_mismatch: false,
                        warning: false,
                    });
                }
            }
        }
        if let Some(properties) = k.properties.filter(|v| v.truthy()) {
            for (name, schema) in self.entries(properties) {
                processed(name.clone(), &mut live, r);
                if let Some(c) = child(&name) {
                    property(r, c, &name, schema)?;
                }
            }
        }
        if let Some(patterns) = k.pattern_properties.filter(|v| v.truthy()) {
            for (pattern, schema) in self.entries(patterns) {
                // ponytail: patterns `regex` can't run (lookaround, backreferences) are skipped
                // like invalid ones.
                let re = self.regex(&pattern);
                let JsRegex::Re(re) = &*re else { continue };
                let mut matched = Vec::new();
                for (i, name) in order.iter().enumerate() {
                    if live[i] && re.is_match(name) {
                        matched.push(*name);
                        if let Some(c) = child(name) {
                            property(r, c, name, schema)?;
                        }
                    }
                }
                for name in matched {
                    processed(Cow::Borrowed(name), &mut live, r);
                }
            }
        }
        if let Some(additional) = k.additional_properties {
            for i in 0..order.len() {
                if !live[i] {
                    continue;
                }
                let name = order[i];
                processed(Cow::Borrowed(name), &mut live, r);
                if let Some(c) = child(name) {
                    match additional {
                        SVal::Bool(false) => not_allowed(r, c, name)?,
                        SVal::Bool(true) => {}
                        _ => property(r, c, name, additional)?,
                    }
                }
            }
        }
        if let Some(unevaluated) = k.unevaluated_properties {
            let mut matched = Vec::new();
            for i in 0..order.len() {
                let name = order[i];
                if !live[i] || r.processed.contains(name) {
                    continue;
                }
                matched.push(name);
                if let Some(c) = child(name) {
                    match unevaluated {
                        SVal::Bool(false) => not_allowed(r, c, name)?,
                        SVal::Bool(true) => {}
                        _ => property(r, c, name, unevaluated)?,
                    }
                }
            }
            for name in matched {
                processed(Cow::Borrowed(name), &mut live, r);
            }
        }
        if let Some(max) = num(k.max_properties).filter(|m| (props.len() as f64) > *m) {
            self.push(
                r,
                node,
                t(
                    objs,
                    "Object has more properties than limit of {0}.",
                    &[Arg::N(max)],
                )?,
            );
        }
        if let Some(min) = num(k.min_properties).filter(|m| (props.len() as f64) < *m) {
            self.push(
                r,
                node,
                t(
                    objs,
                    "Object has fewer properties than the required number of {0}",
                    &[Arg::N(min)],
                )?,
            );
        }
        let dependencies = |r: &mut VResult<'a>, key: &str, dep: &'a SVal| -> Result<(), String> {
            if let SVal::Arr(required) = dep {
                for p in required.iter() {
                    let name = match p {
                        SVal::Str(s) => Cow::Borrowed(&**s),
                        v => Cow::Owned(js_string(v)),
                    };
                    if child(&name).is_none() {
                        let m = t(
                            objs,
                            "Object is missing property {0} required by property {1}.",
                            &[Arg::V(p), Arg::S(key)],
                        )?;
                        self.push(r, node, m);
                    } else {
                        r.pvm += 1;
                    }
                }
            } else if let Some(schema) = Some(as_schema(dep)).filter(|s| s.truthy()) {
                let mut pr = VResult::default();
                self.validate(node, schema, &mut pr)?;
                r.merge_property_match(pr);
            }
            Ok(())
        };
        if let Some(map) = k.dependent_required.filter(|v| v.truthy()) {
            for (key, dep) in self.entries(map) {
                if child(&key).is_some() && matches!(dep, SVal::Arr(_)) {
                    dependencies(r, &key, dep)?;
                }
            }
        }
        if let Some(map) = k.dependent_schemas.filter(|v| v.truthy()) {
            for (key, dep) in self.entries(map) {
                if child(&key).is_some() && matches!(dep, SVal::Obj(_)) {
                    dependencies(r, &key, dep)?;
                }
            }
        }
        if let Some(map) = k.dependencies.filter(|v| v.truthy()) {
            for (key, dep) in self.entries(map) {
                if child(&key).is_some() {
                    dependencies(r, &key, dep)?;
                }
            }
        }
        if let Some(names) = k.property_names.map(as_schema).filter(|s| s.truthy()) {
            for &p in props {
                if let Kind::Property { key, .. } = self.node(p).kind {
                    self.validate(key, names, r)?;
                }
            }
        }
        Ok(())
    }

    fn view(&self, j: J<'a>) -> P<'a> {
        match j {
            J::Doc(id) => match &self.node(id).kind {
                Kind::Null | Kind::Property { .. } => P::Null,
                Kind::Bool(b) => P::Bool(*b),
                Kind::Num { value, .. } => P::Num(*value),
                Kind::Str(s) => P::Str(s),
                Kind::Array(items) => P::Arr(items.iter().map(|&i| J::Doc(i)).collect()),
                Kind::Object(props) => {
                    let mut out: Vec<(&str, J)> = Vec::new();
                    for &p in props {
                        if let Kind::Property {
                            key,
                            value: Some(v),
                        } = self.node(p).kind
                        {
                            let key = self.doc.str_value(key);
                            match out.iter_mut().find(|(k, _)| *k == key) {
                                Some(e) => e.1 = J::Doc(v),
                                None => out.push((key, J::Doc(v))),
                            }
                        }
                    }
                    P::Obj(out)
                }
            },
            J::Schema(v) => match v {
                SVal::Null => P::Null,
                SVal::Bool(b) => P::Bool(*b),
                SVal::Num(n) => P::Num(*n),
                SVal::Str(s) => P::Str(s),
                SVal::Arr(a) => P::Arr(a.iter().map(J::Schema).collect()),
                SVal::Obj(id) => P::Obj(
                    self.objs[*id as usize]
                        .iter()
                        .map(|(k, v)| (&**k, J::Schema(v)))
                        .collect(),
                ),
            },
        }
    }

    /// utils/objects `equals`
    fn equals(&self, a: J<'a>, b: J<'a>) -> bool {
        match (self.view(a), self.view(b)) {
            (P::Null, P::Null) => true,
            (P::Bool(x), P::Bool(y)) => x == y,
            (P::Num(x), P::Num(y)) => x == y,
            (P::Str(x), P::Str(y)) => x == y,
            (P::Arr(x), P::Arr(y)) => {
                x.len() == y.len() && x.iter().zip(&y).all(|(p, q)| self.equals(*p, *q))
            }
            (P::Obj(x), P::Obj(y)) => {
                x.len() == y.len()
                    && x.iter().all(|(key, p)| {
                        y.iter()
                            .find(|(k, _)| k == key)
                            .is_some_and(|(_, q)| self.equals(*p, *q))
                    })
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn helpers() {
        assert!(has_uri_scheme("a:b"));
        assert!(!has_uri_scheme(":b"));
        assert!(!has_uri_scheme("a/b:c"));
        assert_eq!(normalize_floats(0.25), Some((25.0, 2)));
        assert_eq!(normalize_floats(1e-7), Some((1.0, 7)));
        assert_eq!(normalize_floats(1.5e21), Some((15.0, -20)));
        assert_eq!(normalize_floats(f64::NAN), None);
        let email = &FORMATS["email"];
        assert!(
            email.re.is_match("a.b@c.io")
                && email.re.is_match("a@[1.2.3.4]")
                && !email.re.is_match("a b@c.io")
        );
        let host = &FORMATS["hostname"];
        assert!(
            format_matches("hostname", host, "Ex-1.com")
                && !format_matches("hostname", host, "\u{212a}.com")
        );
        assert!(FORMATS["date-time"].re.is_match("2020-01-01t00:00:00z"));
        assert!(FORMATS["ipv6"].re.is_match("::FFFF:1.2.3.4"));
    }
}
