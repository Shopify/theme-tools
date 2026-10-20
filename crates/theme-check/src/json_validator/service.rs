//! vscode-json-languageservice `services/jsonSchemaService.js`: schema handles, `fileMatch`
//! associations and `$ref` resolution. Schemas live in a JS-like object arena because TS resolves
//! them by mutating shared objects in place (merging `$ref` targets into the referring object),
//! and later resolutions see those mutations.

use super::jsregex::{compile, glob_source, JsRegex};
use super::{t, url, Arg};
use crate::docs::SchemaDefinition;
use crate::js::{len16, trim_start};
use crate::json::{array_index, js_number_to_string, parse_with};
use crate::path::{display_string, normalize_id, normalize_resource_for_matching};
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;

/// A JS value from a schema. Objects are arena ids, so they keep their identity and mutations;
/// arrays are never mutated.
#[derive(Clone, Debug)]
pub enum SVal {
    Null,
    Bool(bool),
    Num(f64),
    Str(Arc<str>),
    Arr(Arc<[SVal]>),
    Obj(u32),
}

/// Own properties in JS order.
pub type Obj = Vec<(Arc<str>, SVal)>;

/// `asSchema(true)`: `{}`.
pub static EMPTY: SVal = SVal::Obj(0);
/// `asSchema(false)`: `{ not: {} }`.
pub static FALSE_SCHEMA: SVal = SVal::Obj(1);
/// Stands in for a one-char string from indexing a string: truthy, not an object, and a no-op
/// schema.
pub static ONE: SVal = SVal::Num(1.0);

impl SVal {
    pub fn truthy(&self) -> bool {
        match self {
            SVal::Null => false,
            SVal::Bool(b) => *b,
            SVal::Num(n) => *n != 0.0 && !n.is_nan(),
            SVal::Str(s) => !s.is_empty(),
            SVal::Arr(_) | SVal::Obj(_) => true,
        }
    }

    pub fn num(&self) -> Option<f64> {
        match self {
            SVal::Num(n) => Some(*n),
            _ => None,
        }
    }
}

pub fn truthy(v: Option<&SVal>) -> bool {
    v.is_some_and(SVal::truthy)
}

/// `v[key]` for an object's own key.
pub fn get<'a>(objs: &'a [Obj], v: &SVal, key: &str) -> Option<&'a SVal> {
    match v {
        SVal::Obj(id) => objs[*id as usize]
            .iter()
            .find(|(k, _)| &**k == key)
            .map(|(_, v)| v),
        _ => None,
    }
}

/// `String(v)`.
pub fn js_string(v: &SVal) -> String {
    match v {
        SVal::Null => "null".into(),
        SVal::Bool(b) => b.to_string(),
        SVal::Num(n) => js_number_to_string(*n),
        SVal::Str(s) => s.to_string(),
        SVal::Arr(a) => js_join(a, ","),
        SVal::Obj(_) => "[object Object]".into(),
    }
}

/// `array.join(sep)`: `null` items are empty.
pub fn js_join(a: &[SVal], sep: &str) -> String {
    let items: Vec<String> = a
        .iter()
        .map(|v| {
            if let SVal::Null = v {
                String::new()
            } else {
                js_string(v)
            }
        })
        .collect();
    items.join(sep)
}

/// `JSON.stringify(v)`.
pub fn stringify(objs: &[Obj], v: &SVal) -> String {
    match v {
        SVal::Num(n) if !n.is_finite() => "null".into(),
        SVal::Str(s) => serde_json::to_string(&**s).unwrap(),
        SVal::Arr(a) => format!(
            "[{}]",
            a.iter()
                .map(|v| stringify(objs, v))
                .collect::<Vec<_>>()
                .join(",")
        ),
        SVal::Obj(id) => {
            let entries: Vec<String> = objs[*id as usize]
                .iter()
                .map(|(k, v)| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(&**k).unwrap(),
                        stringify(objs, v)
                    )
                })
                .collect();
            format!("{{{}}}", entries.join(","))
        }
        v => js_string(v),
    }
}

/// `new UnresolvedSchema(schema, errors)`; `schema: None` is `undefined`.
pub struct Unresolved {
    pub schema: Option<SVal>,
    pub errors: Vec<String>,
}

pub struct Resolved {
    pub schema: SVal,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// What waits on a handle's unresolved schema.
enum Reaction {
    /// `getResolvedSchema`: `resolveSchemaContent`.
    Top,
    /// `resolveExternalLink`'s callback.
    External {
        node: u32,
        seg: Option<String>,
        uri: String,
    },
}

/// `SchemaHandle.unresolvedSchema`, a promise.
enum Load {
    NotStarted,
    Pending(Vec<Reaction>),
    Ready(Arc<Unresolved>),
}

struct Handle {
    uri: String,
    load: Load,
    resolved: Option<Result<Arc<Resolved>, String>>,
    anchors: Option<HashMap<String, u32>>,
}

/// The microtasks of a resolution: a load settling, or a `.then` callback running.
enum Job {
    LoadDone(usize),
    React(usize, Reaction),
}

/// One `resolveSchemaContent` call's closure state.
#[derive(Default)]
struct Ctx {
    root: Option<SVal>,
    draft03: bool,
    errors: Vec<String>,
    unsupported: Vec<&'static str>,
    /// The first throw. ponytail: TS rejects with whichever rejection settles first, which can
    /// differ when several branches throw.
    failed: Option<String>,
}

impl Ctx {
    fn unsupported(&mut self, feature: &'static str) {
        if !self.unsupported.contains(&feature) {
            self.unsupported.push(feature);
        }
    }
}

/// `FilePatternAssociation`
struct Association {
    globs: Vec<(regex::Regex, bool)>,
    uris: Vec<String>,
}

impl Association {
    fn new(patterns: &[String], uris: Vec<String>) -> Self {
        let mut globs = Vec::new();
        for p in patterns {
            let include = !p.starts_with('!');
            let p = if include { p.as_str() } else { &p[1..] };
            if !p.is_empty() {
                let p = p.strip_prefix('/').unwrap_or(p);
                match compile(&glob_source(&format!("**/{p}")), false) {
                    JsRegex::Re(re) => globs.push((re, include)),
                    // `new RegExp` throws: the catch drops every glob. ponytail: Unsupported
                    // can't come out of a glob source.
                    _ => {
                        return Association {
                            globs: Vec::new(),
                            uris: Vec::new(),
                        }
                    }
                }
            }
        }
        Association { globs, uris }
    }

    fn matches(&self, file: &str) -> bool {
        let mut m = false;
        for (re, include) in &self.globs {
            if re.is_match(file) {
                m = *include;
            }
        }
        m
    }
}

pub struct Service {
    pub objs: Vec<Obj>,
    /// `indexBy((x) => x.uri, schemas)`: the request service's contents.
    contents: HashMap<String, String>,
    handles: Vec<Handle>,
    by_id: HashMap<String, usize>,
    associations: Vec<Association>,
    /// `cachedSchemaForResource`: the resource and its combined schema handle.
    cached: Option<(String, Option<usize>)>,
    queue: VecDeque<Job>,
    ctx: Ctx,
}

impl Service {
    /// `getLanguageService` (with the draft-04/07 meta-schema contributions), then `configure`.
    pub fn new(defs: &[SchemaDefinition]) -> Self {
        let mut s = Service {
            objs: vec![Vec::new(), vec![("not".into(), SVal::Obj(0))]],
            contents: defs
                .iter()
                .map(|d| (d.uri.clone(), d.schema.clone()))
                .collect(),
            handles: Vec::new(),
            by_id: HashMap::new(),
            associations: Vec::new(),
            cached: None,
            queue: VecDeque::new(),
            ctx: Ctx::default(),
        };
        let meta: Value = serde_json::from_str(include_str!("meta_schemas.json")).unwrap();
        for (id, schema) in meta["schemas"].as_object().unwrap() {
            let content = s.alloc(schema);
            s.add_handle(normalize_id(id), Some(content));
        }
        for d in defs {
            let id = normalize_id(&d.uri);
            if let Some(fm) = d.file_match.as_ref().filter(|fm| !fm.is_empty()) {
                s.associations.push(Association::new(fm, vec![id.clone()]));
            }
            s.get_or_add(&id);
        }
        s
    }

    fn alloc(&mut self, v: &Value) -> SVal {
        match v {
            Value::Null => SVal::Null,
            Value::Bool(b) => SVal::Bool(*b),
            // ponytail: a number past f64 range (1e400) parses to null, not Infinity.
            Value::Number(n) => n.as_f64().map_or(SVal::Null, SVal::Num),
            Value::String(s) => SVal::Str(s.as_str().into()),
            Value::Array(a) => SVal::Arr(a.iter().map(|v| self.alloc(v)).collect()),
            Value::Object(m) => {
                let obj = m
                    .iter()
                    .map(|(k, v)| (Arc::from(k.as_str()), self.alloc(v)))
                    .collect();
                self.objs.push(obj);
                SVal::Obj((self.objs.len() - 1) as u32)
            }
        }
    }

    fn new_obj(&mut self, obj: Obj) -> u32 {
        self.objs.push(obj);
        (self.objs.len() - 1) as u32
    }

    fn get(&self, id: u32, key: &str) -> Option<&SVal> {
        get(&self.objs, &SVal::Obj(id), key)
    }

    /// `obj[key] = value`, in JS key order.
    fn set(&mut self, id: u32, key: Arc<str>, value: SVal) {
        let obj = &mut self.objs[id as usize];
        if let Some(slot) = obj.iter_mut().find(|(k, _)| *k == key) {
            slot.1 = value;
            return;
        }
        let at = match array_index(&key) {
            Some(n) => obj
                .iter()
                .take_while(|(k, _)| array_index(k).is_some_and(|m| m < n))
                .count(),
            None => obj.len(),
        };
        obj.insert(at, (key, value));
    }

    fn add_handle(&mut self, id: String, content: Option<SVal>) -> usize {
        let load = match content {
            Some(c) if c.truthy() => Load::Ready(Arc::new(Unresolved {
                schema: Some(c),
                errors: Vec::new(),
            })),
            _ => Load::NotStarted,
        };
        self.handles.push(Handle {
            uri: id.clone(),
            load,
            resolved: None,
            anchors: None,
        });
        self.by_id.insert(id, self.handles.len() - 1);
        self.handles.len() - 1
    }

    fn get_or_add(&mut self, id: &str) -> usize {
        match self.by_id.get(id) {
            Some(&h) => h,
            None => self.add_handle(id.to_string(), None),
        }
    }

    /// `getSchemaForResource(resource, document)`. `root_schema_prop` is `getSchemaFromProperty`'s
    /// input: the value of the root object's first `$schema` property with a string value.
    pub fn schema_for_resource(
        &mut self,
        resource: &str,
        schema_prop: Option<&str>,
    ) -> Result<Option<Arc<Resolved>>, String> {
        if let Some(id) = schema_prop {
            let id = if has_scheme_prefix(id) {
                id.to_string()
            } else {
                url::resolve(id, resource).ok_or("Invalid URL")?
            };
            if !id.is_empty() {
                let h = self.get_or_add(&normalize_id(&id));
                return self.resolved(h).map(Some);
            }
        }
        if let Some((r, h)) = &self.cached {
            if r == resource {
                return h.map(|h| self.resolved(h)).transpose();
            }
        }
        let file = normalize_resource_for_matching(resource);
        let mut ids: Vec<&str> = Vec::new();
        for a in &self.associations {
            if a.matches(&file) {
                for id in &a.uris {
                    if !ids.contains(&id.as_str()) {
                        ids.push(id);
                    }
                }
            }
        }
        let ids: Vec<String> = ids.into_iter().map(String::from).collect();
        let h = match ids.len() {
            0 => None,
            1 => Some(self.get_or_add(&ids[0])),
            _ => {
                // createCombinedSchema: a new handle each time.
                let refs = ids
                    .iter()
                    .map(|id| {
                        SVal::Obj(
                            self.new_obj(vec![("$ref".into(), SVal::Str(id.as_str().into()))]),
                        )
                    })
                    .collect();
                let root = self.new_obj(vec![("allOf".into(), SVal::Arr(refs))]);
                let id = format!(
                    "schemaservice://combinedSchema/{}",
                    url::encode_uri_component(resource)
                );
                Some(self.add_handle(id, Some(SVal::Obj(root))))
            }
        };
        self.cached = Some((resource.to_string(), h));
        h.map(|h| self.resolved(h)).transpose()
    }

    /// `handle.getResolvedSchema()`, memoized like the TS promise (rejections included).
    fn resolved(&mut self, h: usize) -> Result<Arc<Resolved>, String> {
        if let Some(r) = &self.handles[h].resolved {
            return r.clone();
        }
        self.ctx = Ctx::default();
        self.then(h, Reaction::Top);
        while let Some(job) = self.queue.pop_front() {
            if let Err(e) = self.run(job) {
                self.ctx.failed.get_or_insert(e);
            }
        }
        let ctx = std::mem::take(&mut self.ctx);
        let r = match ctx.failed {
            Some(e) => Err(e),
            None if ctx.draft03 => Ok(Arc::new(Resolved {
                schema: EMPTY.clone(),
                errors: vec!["Draft-03 schemas are not supported.".into()],
                warnings: Vec::new(),
            })),
            None => {
                let mut warnings = Vec::new();
                if !ctx.unsupported.is_empty() {
                    warnings.push(fmt(
                        "The schema uses meta-schema features ({0}) that are not yet supported by the validator.",
                        &[&ctx.unsupported.join(", ")],
                    ));
                }
                Ok(Arc::new(Resolved {
                    schema: ctx.root.unwrap(),
                    errors: ctx.errors,
                    warnings,
                }))
            }
        };
        self.handles[h].resolved = Some(r.clone());
        r
    }

    /// `handle.getUnresolvedSchema().then(reaction)`
    fn then(&mut self, h: usize, r: Reaction) {
        match &mut self.handles[h].load {
            Load::NotStarted => {
                self.handles[h].load = Load::Pending(vec![r]);
                self.queue.push_back(Job::LoadDone(h));
            }
            Load::Pending(waiting) => waiting.push(r),
            Load::Ready(_) => self.queue.push_back(Job::React(h, r)),
        }
    }

    fn unresolved(&self, h: usize) -> Arc<Unresolved> {
        match &self.handles[h].load {
            Load::Ready(u) => u.clone(),
            _ => unreachable!("reaction before load"),
        }
    }

    fn run(&mut self, job: Job) -> Result<(), String> {
        match job {
            Job::LoadDone(h) => {
                let u = Arc::new(self.load_schema(h));
                if let Load::Pending(waiting) =
                    std::mem::replace(&mut self.handles[h].load, Load::Ready(u))
                {
                    self.queue
                        .extend(waiting.into_iter().map(|r| Job::React(h, r)));
                }
                Ok(())
            }
            Job::React(h, Reaction::Top) => self.resolve_schema_content(h),
            Job::React(h, Reaction::External { node, seg, uri }) => {
                let u = self.unresolved(h);
                if let Some(e) = u.errors.first() {
                    let loc = match &seg {
                        Some(s) if !s.is_empty() => format!("{uri}#{s}"),
                        _ => uri,
                    };
                    self.ctx
                        .errors
                        .push(fmt("Problems loading reference '{0}': {1}", &[&loc, e]));
                }
                self.merge_ref(node, u.schema.as_ref(), h, seg.as_deref())?;
                self.resolve_refs(&SVal::Obj(node), u.schema.as_ref(), h)
            }
        }
    }

    /// `loadSchema(url)` with JSONValidator's `getSchemaForURI` as the request service.
    fn load_schema(&mut self, h: usize) -> Unresolved {
        let mut url = self.handles[h].uri.clone();
        if let Some(rest) = url.strip_prefix("http://json-schema.org/") {
            url = format!("https://json-schema.org/{rest}");
        }
        let missing = format!("No schema for '{url}' found");
        let mut content = self
            .contents
            .get(&url)
            .filter(|s| !s.is_empty())
            .map_or(missing.as_str(), String::as_str);
        let mut errors = Vec::new();
        if content.starts_with('\u{feff}') {
            errors.push(fmt(
                "Problem reading content from '{0}': UTF-8 with BOM detected, only UTF 8 is allowed.",
                &[&display_string(&url)],
            ));
            content = trim_start(content);
        }
        let (value, error) = parse_with(content, false);
        if let Some(e) = error {
            let offset = js_number_to_string(len16(&content[..e.offset]) as f64);
            errors.push(fmt(
                "Unable to parse content from '{0}': Parse error at offset {1}.",
                &[&display_string(&url), &offset],
            ));
        }
        Unresolved {
            schema: value.map(|v| self.alloc(&v)),
            errors,
        }
    }

    /// `resolveSchemaContent(unresolved, handle)` up to its `resolveRefs`.
    fn resolve_schema_content(&mut self, h: usize) -> Result<(), String> {
        let u = self.unresolved(h);
        self.ctx.errors = u.errors.clone();
        let schema = match &u.schema {
            None => return Err("Cannot read properties of undefined (reading '$schema')".into()),
            Some(SVal::Null) => {
                return Err("Cannot read properties of null (reading '$schema')".into())
            }
            Some(s) => s.clone(),
        };
        if let Some(draft) = get(&self.objs, &schema, "$schema").filter(|v| v.truthy()) {
            if normalize_id(&js_string(draft)) == "http://json-schema.org/draft-03/schema" {
                self.ctx.draft03 = true;
                return Ok(());
            }
        }
        self.ctx.root = Some(schema.clone());
        self.resolve_refs(&schema, Some(&schema), h)
    }

    /// `traverseNodes(root, handler)`: every object reachable through schema keywords, once.
    fn traverse(
        &mut self,
        root: &SVal,
        mut handler: impl FnMut(&mut Self, u32) -> Result<(), String>,
    ) -> Result<(), String> {
        let SVal::Obj(root) = root else { return Ok(()) };
        let mut seen = std::collections::HashSet::new();
        let mut to_walk = vec![*root];
        while let Some(next) = to_walk.pop() {
            if !seen.insert(next) {
                continue;
            }
            handler(self, next)?;
            let objs = &self.objs;
            let get = |key| get(objs, &SVal::Obj(next), key);
            let mut push = |v: &SVal| {
                if let SVal::Obj(id) = v {
                    to_walk.push(*id);
                }
            };
            for key in [
                "additionalItems",
                "additionalProperties",
                "not",
                "contains",
                "propertyNames",
                "if",
                "then",
                "else",
                "unevaluatedItems",
                "unevaluatedProperties",
            ] {
                if let Some(v) = get(key) {
                    push(v);
                }
            }
            for key in [
                "definitions",
                "$defs",
                "properties",
                "patternProperties",
                "dependencies",
                "dependentSchemas",
            ] {
                if let Some(SVal::Obj(map)) = get(key) {
                    objs[*map as usize].iter().for_each(|(_, v)| push(v));
                }
            }
            for key in ["anyOf", "allOf", "oneOf", "prefixItems"] {
                if let Some(SVal::Arr(a)) = get(key) {
                    a.iter().for_each(&mut push);
                }
            }
            match get("items") {
                Some(SVal::Arr(a)) => a.iter().for_each(&mut push),
                Some(v) => push(v),
                None => {}
            }
        }
        Ok(())
    }

    /// `resolveRefs(node, parentSchema, parentHandle)`
    fn resolve_refs(
        &mut self,
        node: &SVal,
        parent_schema: Option<&SVal>,
        parent: usize,
    ) -> Result<(), String> {
        self.traverse(node, |s, next| {
            let mut seen_refs: Vec<Arc<str>> = Vec::new();
            while let Some(r) = s.get(next, "$ref").filter(|v| v.truthy()).cloned() {
                let SVal::Str(r) = r else {
                    return Err("ref.split is not a function".into());
                };
                // `ref.split('#', 2)`
                let mut segments = r.split('#');
                let (seg0, seg1) = (segments.next().unwrap(), segments.next());
                s.objs[next as usize].retain(|(k, _)| &**k != "$ref");
                if !seg0.is_empty() {
                    return s.resolve_external_link(next, seg0, seg1, parent);
                }
                if !seen_refs.contains(&r) {
                    s.merge_ref(next, parent_schema, parent, seg1)?;
                    seen_refs.push(r.clone());
                }
            }
            if truthy(s.get(next, "$recursiveRef")) {
                s.ctx.unsupported("$recursiveRef");
            }
            if truthy(s.get(next, "$dynamicRef")) {
                s.ctx.unsupported("$dynamicRef");
            }
            Ok(())
        })
    }

    fn resolve_external_link(
        &mut self,
        node: u32,
        uri: &str,
        seg: Option<&str>,
        parent: usize,
    ) -> Result<(), String> {
        let uri = if is_absolute(uri) {
            uri.to_string()
        } else {
            url::resolve(uri, &self.handles[parent].uri).ok_or("Invalid URL")?
        };
        let uri = normalize_id(&uri);
        let h = self.get_or_add(&uri);
        self.then(
            h,
            Reaction::External {
                node,
                seg: seg.map(String::from),
                uri,
            },
        );
        Ok(())
    }

    /// `mergeRef(target, sourceRoot, sourceHandle, refSegment)`
    fn merge_ref(
        &mut self,
        target: u32,
        source_root: Option<&SVal>,
        source: usize,
        seg: Option<&str>,
    ) -> Result<(), String> {
        let section = match seg {
            None | Some("") => source_root.cloned(),
            Some(s) if s.starts_with('/') => self.find_section_by_json_pointer(source_root, s)?,
            Some(s) => self.find_schema_by_id(source_root, source, s),
        };
        match section {
            Some(section) if section.truthy() => self.merge(target, &section),
            _ => {
                let message = fmt(
                    "$ref '{0}' in '{1}' can not be resolved.",
                    &[seg.unwrap_or(""), &self.handles[source].uri],
                );
                self.ctx.errors.push(message);
                Ok(())
            }
        }
    }

    /// `merge(target, section)`: own enumerable keys but `id` and `$id`.
    fn merge(&mut self, target: u32, section: &SVal) -> Result<(), String> {
        let entries: Vec<(Arc<str>, SVal)> = match section {
            SVal::Obj(id) => {
                let obj = &self.objs[*id as usize];
                if obj.iter().any(|(k, _)| &**k == "hasOwnProperty") {
                    return Err("section.hasOwnProperty is not a function".into());
                }
                obj.iter()
                    .filter(|(k, _)| &**k != "id" && &**k != "$id")
                    .cloned()
                    .collect()
            }
            SVal::Arr(a) => a
                .iter()
                .enumerate()
                .map(|(i, v)| (i.to_string().into(), v.clone()))
                .collect(),
            SVal::Str(s) => utf16_units(s)
                .enumerate()
                .map(|(i, c)| (i.to_string().into(), c))
                .collect(),
            _ => Vec::new(),
        };
        for (k, v) in entries {
            self.set(target, k, v);
        }
        Ok(())
    }

    fn find_section_by_json_pointer(
        &self,
        root: Option<&SVal>,
        path: &str,
    ) -> Result<Option<SVal>, String> {
        let path = url::decode_uri_component(path).ok_or("URI malformed")?;
        let path = path.strip_prefix('/').unwrap_or(&path);
        let mut current = root.cloned();
        for part in path.split('/') {
            let part = part.replace("~1", "/").replace("~0", "~");
            current = self.index(current.as_ref(), &part)?;
            if !truthy(current.as_ref()) {
                break;
            }
        }
        Ok(current)
    }

    /// `current[part]`. ponytail: `Object.prototype` members (`constructor`, `toString`, ...)
    /// and primitive methods read as `undefined`.
    fn index(&self, current: Option<&SVal>, part: &str) -> Result<Option<SVal>, String> {
        Ok(match current {
            None => {
                return Err(format!(
                    "Cannot read properties of undefined (reading '{part}')"
                ))
            }
            Some(SVal::Null) => {
                return Err(format!("Cannot read properties of null (reading '{part}')"))
            }
            Some(SVal::Obj(id)) => self.get(*id, part).cloned(),
            Some(SVal::Arr(a)) if part == "length" => Some(SVal::Num(a.len() as f64)),
            Some(SVal::Arr(a)) => array_index(part).and_then(|i| a.get(i as usize).cloned()),
            Some(SVal::Str(s)) if part == "length" => Some(SVal::Num(len16(s) as f64)),
            Some(SVal::Str(s)) => array_index(part).and_then(|i| utf16_units(s).nth(i as usize)),
            Some(_) => None,
        })
    }

    fn find_schema_by_id(&mut self, root: Option<&SVal>, h: usize, id: &str) -> Option<SVal> {
        if self.handles[h].anchors.is_none() {
            let anchors = self.collect_anchors(root);
            self.handles[h].anchors = Some(anchors);
        }
        self.handles[h]
            .anchors
            .as_ref()
            .unwrap()
            .get(id)
            .map(|&o| SVal::Obj(o))
    }

    /// `collectAnchors(root)`. ponytail: non-string `$anchor`s are skipped (TS keys its Map by
    /// them, so they only matter for duplicate errors).
    fn collect_anchors(&mut self, root: Option<&SVal>) -> HashMap<String, u32> {
        let mut result = HashMap::new();
        let Some(root) = root else { return result };
        let _ = self.traverse(root, |s, next| {
            let id = s
                .get(next, "$id")
                .filter(|v| v.truthy())
                .or_else(|| s.get(next, "id"));
            let anchor = match id {
                Some(SVal::Str(id)) if id.starts_with('#') => Some(SVal::Str(id[1..].into())),
                _ => s.get(next, "$anchor").cloned(),
            };
            if let Some(SVal::Str(a)) = anchor.filter(|a| a.truthy()) {
                if result.contains_key(&*a) {
                    s.ctx
                        .errors
                        .push(fmt("Duplicate anchor declaration: '{0}'", &[&a]));
                } else {
                    result.insert(a.to_string(), next);
                }
            }
            if truthy(s.get(next, "$recursiveAnchor")) {
                s.ctx.unsupported("$recursiveAnchor");
            }
            if truthy(s.get(next, "$dynamicAnchor")) {
                s.ctx.unsupported("$dynamicAnchor");
            }
            Ok(())
        });
        result
    }
}

/// `l10n.t(template, ...strings)`
fn fmt(template: &str, args: &[&str]) -> String {
    let args: Vec<Arg> = args.iter().map(|s| Arg::S(s)).collect();
    t(&[], template, &args).unwrap()
}

/// A string's UTF-16 units as one-char strings. ponytail: the halves of an astral char become
/// U+FFFD.
fn utf16_units(s: &str) -> impl Iterator<Item = SVal> + '_ {
    s.chars().flat_map(|c| {
        let n = c.len_utf16();
        let first = if n == 1 {
            SVal::Str(c.to_string().into())
        } else {
            SVal::Str("\u{fffd}".into())
        };
        std::iter::once(first).chain((n == 2).then(|| SVal::Str("\u{fffd}".into())))
    })
}

/// `/^\w[\w\d+.-]*:/` (getSchemaFromProperty: "has scheme").
fn has_scheme_prefix(s: &str) -> bool {
    let word = |c: char| c.is_ascii_alphanumeric() || c == '_';
    let mut cs = s.chars();
    cs.next().is_some_and(word) && {
        let rest = cs.as_str();
        let end = rest
            .find(|c: char| !(word(c) || matches!(c, '+' | '.' | '-')))
            .unwrap_or(rest.len());
        rest[end..].starts_with(':')
    }
}

/// `/^[A-Za-z][A-Za-z0-9+\-.+]*:\/\/.*/` (resolveExternalLink).
fn is_absolute(s: &str) -> bool {
    let mut cs = s.chars();
    cs.next().is_some_and(|c| c.is_ascii_alphabetic()) && {
        let rest = cs.as_str();
        let end = rest
            .find(|c: char| !(c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.')))
            .unwrap_or(rest.len());
        rest[end..].starts_with("://")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scheme_tests() {
        assert!(has_scheme_prefix("https://x"));
        assert!(has_scheme_prefix("a_b:"));
        assert!(!has_scheme_prefix("./x.json"));
        assert!(!has_scheme_prefix(":x"));
        assert!(is_absolute("https://x"));
        assert!(!is_absolute("https:/x"));
        assert!(!is_absolute("_a://x"));
    }

    #[test]
    fn stringify_like_js() {
        let mut s = Service::new(&[]);
        let v = s.alloc(&serde_json::json!({"a": [1, 1.5, null, "x\n"], "b": {}}));
        assert_eq!(stringify(&s.objs, &v), r#"{"a":[1,1.5,null,"x\n"],"b":{}}"#);
        assert_eq!(
            js_string(&SVal::Arr(
                vec![
                    SVal::Null,
                    SVal::Num(1.0),
                    SVal::Arr(vec![SVal::Str("a".into())].into())
                ]
                .into()
            )),
            ",1,a"
        );
    }
}
