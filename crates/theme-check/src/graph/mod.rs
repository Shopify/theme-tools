//! Port of packages/theme-graph: `buildThemeGraph` (build.ts, augment.ts), module.ts,
//! traverse.ts, serialize.ts and getWebComponentMap.ts, plus theme-check-node's
//! `getReferences` / `getDependencies` on `Deps`.
//!
//! TS traverses with concurrent promises. Here a FIFO worklist traverses each module once, and
//! each module's `dependencies` come out in the order TS pushes them (see `traverse_liquid_schema`
//! and `traverse_json`). `references` and `modules` orders depend on IO timing in TS; they hold
//! the same items here. Any TS throw rejects the whole build, so the first `Err` ends it.
//! ponytail: a TS throw that lands while its promise isn't awaited yet (a schema block's traversal
//! during the `getThemeBlockNames` read) is an unhandled rejection that crashes Node; here it's
//! just a failed build.

pub mod web_components;

use crate::context::{Deps, FileSystem, FileType, Mode};
use crate::js;
use crate::json::{parse_json, truthy, JsonNode, Loc, PathSeg, PropertyNode};
use crate::path;
use crate::schema::{is_snippet, ThemeSchema};
use crate::source::{to_source_code, SourceCode};
use liquid_ast::{visit_liquid, Markup, Node, NodeRef};
use serde_json::{json, Value};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet, VecDeque};

pub use web_components::{get_web_component_map, WebComponentDefinition};

/// `[start, end]`, UTF-16 offsets like TS.
pub type Range = (usize, usize);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Location {
    pub uri: String,
    pub range: Option<Range>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RefType {
    Direct,
    Indirect,
    Preset,
}

impl RefType {
    pub fn as_str(self) -> &'static str {
        match self {
            RefType::Direct => "direct",
            RefType::Indirect => "indirect",
            RefType::Preset => "preset",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reference {
    pub source: Location,
    pub target: Location,
    pub ref_type: RefType,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModuleType {
    Liquid,
    JavaScript,
    Json,
    Css,
    Svg,
    Image,
}

impl ModuleType {
    pub fn as_str(self) -> &'static str {
        match self {
            ModuleType::Liquid => "Liquid",
            ModuleType::JavaScript => "JavaScript",
            ModuleType::Json => "JSON",
            ModuleType::Css => "CSS",
            ModuleType::Svg => "SVG",
            ModuleType::Image => "Image",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModuleKind {
    Layout,
    Section,
    Block,
    Snippet,
    Template,
    SectionGroup,
    /// Assets.
    Unused,
}

impl ModuleKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ModuleKind::Layout => "layout",
            ModuleKind::Section => "section",
            ModuleKind::Block => "block",
            ModuleKind::Snippet => "snippet",
            ModuleKind::Template => "template",
            ModuleKind::SectionGroup => "section-group",
            ModuleKind::Unused => "unused",
        }
    }
}

#[derive(Clone, Debug)]
pub struct ThemeModule {
    pub module_type: ModuleType,
    pub kind: ModuleKind,
    pub uri: String,
    pub dependencies: Vec<Reference>,
    pub references: Vec<Reference>,
    /// Set when traversal starts, so `Some` iff the module is in `graph.modules`.
    pub exists: Option<bool>,
}

pub struct ThemeGraph {
    pub root_uri: String,
    /// `graph.entryPoints`, as indices into `all`.
    entry_points: Vec<usize>,
    /// The ModuleCache: every module created, traversed or not.
    all: Vec<ThemeModule>,
    cache: HashMap<String, usize>,
    /// `graph.modules`, in traversal order.
    order: Vec<usize>,
}

impl ThemeGraph {
    /// `graph.modules[uri]`
    pub fn module(&self, uri: &str) -> Option<&ThemeModule> {
        self.cache
            .get(uri)
            .map(|&i| &self.all[i])
            .filter(|m| m.exists.is_some())
    }

    /// `Object.values(graph.modules)`
    pub fn modules(&self) -> impl Iterator<Item = &ThemeModule> {
        self.order.iter().map(|&i| &self.all[i])
    }

    pub fn entry_points(&self) -> impl Iterator<Item = &ThemeModule> {
        self.entry_points.iter().map(|&i| &self.all[i])
    }

    /// module.ts `module()`: the cached module for `uri`, created on first use.
    fn module_at(&mut self, module_type: ModuleType, kind: ModuleKind, uri: String) -> usize {
        if let Some(&i) = self.cache.get(&uri) {
            return i;
        }
        let i = self.all.len();
        self.cache.insert(uri.clone(), i);
        self.all.push(ThemeModule {
            module_type,
            kind,
            uri,
            dependencies: Vec::new(),
            references: Vec::new(),
            exists: None,
        });
        i
    }

    /// `getModule(themeGraph, uri)`
    fn get_module(&mut self, uri: &str) -> Result<Option<usize>, String> {
        if let Some(&i) = self.cache.get(uri) {
            return Ok(Some(i));
        }
        let rel = path::relative(uri, &self.root_uri);
        let name = |ext| path::basename(uri, ext);
        Ok(Some(if rel.starts_with("assets") {
            return Ok(self.asset_module(&name(None)));
        } else if rel.starts_with("blocks") {
            self.theme_block_module(&name(Some(".liquid")))
        } else if rel.starts_with("layout") {
            self.layout_module(&name(Some(".liquid")))
        } else if rel.starts_with("sections") {
            if rel.ends_with(".json") {
                self.section_group_module(&name(Some(".json")))
            } else {
                self.section_module(&name(Some(".liquid")))
            }
        } else if rel.starts_with("snippets") {
            self.snippet_module(&name(Some(".liquid")))
        } else if rel.starts_with("templates") {
            self.template_module(uri)?
        } else {
            return Ok(None);
        }))
    }

    /// `getTemplateModule(themeGraph, uri)`
    fn template_module(&mut self, uri: &str) -> Result<usize, String> {
        match extname(uri) {
            "json" => Ok(self.module_at(ModuleType::Json, ModuleKind::Template, uri.to_string())),
            "liquid" => {
                Ok(self.module_at(ModuleType::Liquid, ModuleKind::Template, uri.to_string()))
            }
            _ => Err(format!("Unknown template type for {uri}")),
        }
    }

    fn join(&self, dir: &str, file: &str) -> String {
        path::join(&self.root_uri, &[dir, file])
    }

    fn theme_block_module(&mut self, block_type: &str) -> usize {
        let uri = self.join("blocks", &format!("{block_type}.liquid"));
        self.module_at(ModuleType::Liquid, ModuleKind::Block, uri)
    }

    fn section_module(&mut self, section_type: &str) -> usize {
        let uri = self.join("sections", &format!("{section_type}.liquid"));
        self.module_at(ModuleType::Liquid, ModuleKind::Section, uri)
    }

    fn section_group_module(&mut self, group_type: &str) -> usize {
        let uri = self.join("sections", &format!("{group_type}.json"));
        self.module_at(ModuleType::Json, ModuleKind::SectionGroup, uri)
    }

    /// `getAssetModule(themeGraph, asset)`: `None` for unsupported extensions.
    fn asset_module(&mut self, asset: &str) -> Option<usize> {
        let module_type = match extname(asset) {
            "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "ico" => ModuleType::Image,
            "js" => ModuleType::JavaScript,
            "css" => ModuleType::Css,
            "svg" => ModuleType::Svg,
            _ => return None,
        };
        let uri = self.join("assets", asset);
        Some(self.module_at(module_type, ModuleKind::Unused, uri))
    }

    fn snippet_module(&mut self, snippet: &str) -> usize {
        let uri = self.join("snippets", &format!("{snippet}.liquid"));
        self.module_at(ModuleType::Liquid, ModuleKind::Snippet, uri)
    }

    /// `getLayoutModule(themeGraph, layoutName)` for a defined, non-`false` name.
    fn layout_module(&mut self, layout_name: &str) -> usize {
        let uri = self.join("layout", &format!("{layout_name}.liquid"));
        self.module_at(ModuleType::Liquid, ModuleKind::Layout, uri)
    }
}

/// utils `extname(uri)`: `uri.split('.').pop()`
fn extname(uri: &str) -> &str {
    uri.rsplit('.').next().unwrap_or("")
}

const IGNORED_FOLDERS: [&str; 6] = [".git", "node_modules", "dist", "build", "tmp", "vendor"];

/// context-utils `recursiveReadDirectory(fs, uri, filter)`: files in `readDirectory` order,
/// recursing into directories (except ignored ones) in place. The filter only sees file uris.
pub fn recursive_read_directory(
    fs: &dyn FileSystem,
    uri: &str,
    filter: &dyn Fn(&str) -> bool,
) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    for (child, file_type) in fs.read_directory(uri)? {
        if file_type == FileType::Directory {
            if !IGNORED_FOLDERS.iter().any(|f| child.ends_with(f)) {
                out.extend(recursive_read_directory(fs, &child, filter)?);
            }
        } else if filter(&child) {
            out.push(child);
        }
    }
    Ok(out)
}

/// `buildThemeGraph(rootUri, deps, entryPoints?)` with deps from `Deps`: `fs`, `mode` and the
/// `getSectionSchema` / `getBlockSchema` getters. Sources come from `deps.theme` when the file is
/// there, else from `fs` (TS's default `getSourceCode`). theme-check-node passes
/// `getWebComponentDefinitionReference: () => undefined`, i.e. `&|_| None`.
pub fn build_theme_graph(
    deps: &Deps,
    web_component_ref: &dyn Fn(&str) -> Option<WebComponentDefinition>,
    entry_points: Option<Vec<String>>,
) -> Result<ThemeGraph, String> {
    let root = deps.root_uri.as_str();
    let entry_points = match entry_points {
        Some(uris) => uris,
        None => {
            let [templates, layout, sections, blocks] =
                ["templates", "layout", "sections", "blocks"].map(|d| path::join(root, &[d]));
            let app = deps.mode == Mode::App;
            recursive_read_directory(deps.fs, root, &|uri| {
                uri.starts_with(&templates)
                    || (uri.starts_with(&layout) && uri.ends_with(".liquid"))
                    || (uri.starts_with(&sections) && uri.ends_with(".liquid"))
                    || (app && uri.starts_with(&blocks) && uri.ends_with(".liquid"))
            })?
        }
    };

    let mut b = Builder {
        deps,
        web_component_ref,
        theme_files: deps
            .theme
            .iter()
            .enumerate()
            .map(|(i, f)| (f.uri.as_str(), i))
            .collect(),
        g: ThemeGraph {
            root_uri: root.to_string(),
            entry_points: Vec::new(),
            all: Vec::new(),
            cache: HashMap::new(),
            order: Vec::new(),
        },
        queue: VecDeque::new(),
        theme_block_names: None,
    };
    for uri in &entry_points {
        if let Some(m) = b.g.get_module(uri)? {
            b.g.entry_points.push(m);
        }
    }
    b.queue.extend(b.g.entry_points.iter().copied());
    while let Some(m) = b.queue.pop_front() {
        b.traverse_module(m)?;
    }
    Ok(b.g)
}

struct Builder<'d, 'a> {
    deps: &'d Deps<'a>,
    web_component_ref: &'d dyn Fn(&str) -> Option<WebComponentDefinition>,
    theme_files: HashMap<&'d str, usize>,
    g: ThemeGraph,
    /// Modules to `traverseModule`.
    queue: VecDeque<usize>,
    /// augment.ts `getThemeBlockNames` (memo).
    theme_block_names: Option<Result<Vec<String>, String>>,
}

/// A visitor or schema reference: (target, sourceRange, targetRange).
type Ref = (usize, Range, Option<Range>);

fn undefined_read(prop: &str) -> String {
    format!("Cannot read properties of undefined (reading '{prop}')")
}

/// `node.children.find((child) => child.key.value === 'type')` on `nodeAtPath(...)!`. Throws
/// unless the node is an object or an empty array.
fn type_property<'n, 'a>(
    node: Option<&'n JsonNode<'a>>,
) -> Result<Option<&'n PropertyNode<'a>>, String> {
    match node {
        Some(JsonNode::Object(o)) => Ok(o.get("type")),
        Some(JsonNode::Array(a)) if a.children.is_empty() => Ok(None),
        Some(JsonNode::Array(_)) => Err(undefined_read("value")),
        Some(JsonNode::Literal(_)) => Err(undefined_read("find")),
        None => Err(undefined_read("children")),
    }
}

fn keys<'p>(path: &'p [String]) -> Vec<PathSeg<'p>> {
    path.iter().map(|k| PathSeg::Key(k)).collect()
}

/// An owned `nodeAtPath` segment.
#[derive(Clone)]
enum Seg {
    Key(String),
    Index(usize),
}

fn segs(path: &[Seg]) -> Vec<PathSeg<'_>> {
    path.iter()
        .map(|s| match s {
            Seg::Key(k) => PathSeg::Key(k),
            Seg::Index(i) => PathSeg::Index(*i),
        })
        .collect()
}

/// `x ? ... : ...` on a property read.
fn truthy_get<'v>(v: &'v Value, key: &str) -> Result<Option<&'v Value>, String> {
    Ok(js::get(v, key)?.filter(|v| truthy(v)))
}

impl<'d, 'a> Builder<'d, 'a> {
    fn bind(
        &mut self,
        source: usize,
        target: usize,
        source_range: Option<Range>,
        target_range: Option<Range>,
        ref_type: RefType,
    ) {
        let dependency = Reference {
            source: Location {
                uri: self.g.all[source].uri.clone(),
                range: source_range,
            },
            target: Location {
                uri: self.g.all[target].uri.clone(),
                range: target_range,
            },
            ref_type,
        };
        self.g.all[target].references.push(dependency.clone());
        self.g.all[source].dependencies.push(dependency);
    }

    /// `bind(...)` then `traverseModule(target)`.
    fn link(
        &mut self,
        source: usize,
        target: usize,
        source_range: Option<Range>,
        ref_type: RefType,
    ) {
        self.bind(source, target, source_range, None, ref_type);
        self.queue.push_back(target);
    }

    /// `traverseModule(module, themeGraph, deps)`
    fn traverse_module(&mut self, m: usize) -> Result<(), String> {
        if self.g.all[m].exists.is_some() {
            return Ok(());
        }
        let exists = self.deps.fs.stat(&self.g.all[m].uri).is_ok();
        self.g.all[m].exists = Some(exists);
        self.g.order.push(m);
        if !exists {
            return Ok(());
        }
        match self.g.all[m].module_type {
            ModuleType::Liquid => self.traverse_liquid(m),
            ModuleType::Json => self.traverse_json(m),
            _ => Ok(()),
        }
    }

    /// `traverseLiquidModule`
    fn traverse_liquid(&mut self, m: usize) -> Result<(), String> {
        let uri = self.g.all[m].uri.clone();
        let deps = self.deps;
        let text;
        let local;
        let sc: &SourceCode = match self.theme_files.get(uri.as_str()) {
            Some(&i) => &deps.theme[i],
            None => {
                text = deps.fs.read_file(&uri)?;
                local = to_source_code(&uri, &text);
                &local
            }
        };
        let Some(doc) = sc.liquid_ast() else {
            return Ok(());
        };

        let pos = |byte: usize| sc.position(byte).index as usize;
        let g = &mut self.g;
        let web_component_ref = self.web_component_ref;
        let mut refs: Vec<Ref> = Vec::new();
        visit_liquid(NodeRef::Document(doc), |node, ancestors, exit| {
            if exit {
                return;
            }
            let parent = ancestors.last();
            let tag_range = || parent.map(|p| (pos(p.position().start), pos(p.position().end)));
            match node {
                // {{ 'theme.js' | asset_url }}
                NodeRef::LiquidFilter(f)
                    if matches!(
                        &*f.name,
                        "asset_url" | "asset_img_url" | "inline_asset_content"
                    ) =>
                {
                    let Some(NodeRef::LiquidVariable(v)) = parent else {
                        return;
                    };
                    let Node::String(s) = v.expression.as_ref() else {
                        return;
                    };
                    if !v.filters.first().is_some_and(|f0| std::ptr::eq(f0, f)) {
                        return;
                    }
                    if let Some(t) = g.asset_module(&s.value) {
                        refs.push((t, (pos(v.position.start), pos(v.position.end)), None));
                    }
                }
                // {% content_for 'block', type: 'staticBlockName', id: 'id' %}
                NodeRef::ContentForMarkup(c) => {
                    if c.content_for_type.value != "block" {
                        return;
                    }
                    let Some(arg) = c.args.iter().find(|a| a.name == "type") else {
                        return;
                    };
                    let Node::String(s) = arg.value.as_ref() else {
                        return;
                    };
                    let Some(p) = parent else { return };
                    refs.push((
                        g.theme_block_module(&s.value),
                        (pos(p.position().start), pos(c.position.end)),
                        None,
                    ));
                }
                // {% block 'block-name' %}
                NodeRef::BlockMarkup(b) => {
                    let Some(range) = tag_range() else { return };
                    refs.push((g.theme_block_module(&b.name.value), range, None));
                }
                // <custom-element></custom-element>
                NodeRef::HtmlElement(e) => {
                    let [Node::TextNode(name)] = e.name.as_slice() else {
                        return;
                    };
                    if !name.value.contains('-') {
                        return;
                    }
                    let Some(def) = web_component_ref(&name.value) else {
                        return;
                    };
                    if let Some(t) = g.asset_module(&def.asset_name) {
                        refs.push((
                            t,
                            (pos(e.block_start_position.start), pos(name.position.end)),
                            Some(def.range),
                        ));
                    }
                }
                // {% render 'snippet' %}
                NodeRef::RenderMarkup(r) => {
                    let Node::String(s) = r.snippet.as_ref() else {
                        return;
                    };
                    let Some(range) = tag_range() else { return };
                    refs.push((g.snippet_module(&s.value), range, None));
                }
                NodeRef::LiquidTag(t) => {
                    let range = (pos(t.position.start), pos(t.position.end));
                    match (&*t.name, &t.markup) {
                        // {% sections 'section-group' %}
                        ("sections", Markup::Node(n)) => {
                            if let Node::String(s) = n.as_ref() {
                                refs.push((g.section_group_module(&s.value), range, None));
                            }
                        }
                        // {% section 'section' %}
                        ("section", Markup::Node(n)) => {
                            if let Node::SectionMarkup(s) = n.as_ref() {
                                refs.push((g.section_module(&s.name.value), range, None));
                            }
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        });

        let mut seen = HashSet::new();
        for &(target, source_range, target_range) in &refs {
            self.bind(m, target, Some(source_range), target_range, RefType::Direct);
            if seen.insert(target) {
                self.queue.push_back(target);
            }
        }

        let name = path::basename(&uri, Some(".liquid"));
        let schema = match self.g.all[m].kind {
            ModuleKind::Section => deps.get_section_schema(&name),
            ModuleKind::Block if deps.mode == Mode::Theme => deps.get_block_schema(&name),
            _ => return Ok(()),
        };
        self.traverse_liquid_schema(m, sc, schema)
    }

    /// utils `acceptsLocalBlocks(sectionType, deps)`. `Ok(true)` also stands for its truthy
    /// `Error` returns (missing section, invalid schema). A non-string type misses the
    /// theme-check-node `Map`.
    fn accepts_local_blocks(&self, section_type: Option<&str>) -> Result<bool, String> {
        let Some(schema) = section_type.and_then(|t| self.deps.get_section_schema(t)) else {
            return Ok(true);
        };
        let valid = match schema.valid_schema() {
            Some(Err(_)) => return Ok(true),
            Some(Ok(Some(v))) => v,
            _ => return Err(undefined_read("blocks")),
        };
        let blocks = match js::get(valid, "blocks")? {
            None | Some(Value::Null) => return Ok(false),
            Some(Value::Array(blocks)) => blocks,
            Some(_) => return Err("(validSchema.blocks ?? []).some is not a function".into()),
        };
        for block in blocks {
            // block.type && 'name' in block && block.name
            if js::get(block, "type")?.is_some_and(truthy)
                && js::has(block, "name")?
                && js::get(block, "name")?.is_some_and(truthy)
            {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// `traverseLiquidSchema`. TS runs the blocks loop up to its first `@theme` (which awaits
    /// `getThemeBlockNames()`), then presets and default, then the rest of the blocks; this binds
    /// in that order.
    fn traverse_liquid_schema(
        &mut self,
        m: usize,
        sc: &SourceCode,
        schema: Option<&ThemeSchema>,
    ) -> Result<(), String> {
        let Some(schema) = schema else { return Ok(()) };
        if self.g.all[m].kind == ModuleKind::Section {
            let name = path::basename(&self.g.all[m].uri, Some(".liquid"));
            if self.accepts_local_blocks(Some(&name))? {
                return Ok(());
            }
        }
        let valid = match schema.valid_schema() {
            Some(Err(_)) => return Ok(()),
            Some(Ok(v)) => v.as_ref(),
            None => None,
        };
        let Some(ast) = schema.ast() else {
            return Ok(());
        };
        let Some(valid) = valid else {
            return Err(undefined_read("blocks"));
        };

        // Ranges are `schema.offset + loc` in the schema's file: the theme file whose source holds
        // `schema.value`, else this module's.
        let deps = self.deps;
        let p = schema.value.as_ptr() as usize;
        let file: &SourceCode = match deps.theme.iter().find(|f| {
            (f.source.as_ptr() as usize..=f.source.as_ptr() as usize + f.source.len()).contains(&p)
        }) {
            Some(f) => f,
            None => sc,
        };
        let at = |loc: Loc| {
            (
                file.position(schema.offset + loc.start).index as usize,
                file.position(schema.offset + loc.end).index as usize,
            )
        };

        let blocks = truthy_get(valid, "blocks")?;
        let resume = match blocks {
            Some(blocks) => self.schema_blocks(m, ast, blocks, 0, true, &at)?,
            None => None,
        };
        if let Some(presets) = truthy_get(valid, "presets")? {
            let Value::Array(presets) = presets else {
                return Err("presets.entries is not a function".into());
            };
            for (i, preset) in presets.iter().enumerate() {
                if !js::has(preset, "blocks")? {
                    continue;
                }
                let blocks = js::get(preset, "blocks")?
                    .ok_or_else(|| "Cannot convert undefined or null to object".to_string())?;
                self.preset_blocks(
                    m,
                    ast,
                    blocks,
                    &[Seg::Key("presets".into()), Seg::Index(i)],
                    true,
                    &at,
                )?;
            }
        }
        if js::has(valid, "default")? {
            if let Some(default) = truthy_get(valid, "default")? {
                if js::has(default, "blocks")? {
                    let blocks = js::get(default, "blocks")?
                        .ok_or_else(|| "Cannot convert undefined or null to object".to_string())?;
                    // `traverseSchemaDefault` doesn't recurse into nested blocks.
                    self.preset_blocks(m, ast, blocks, &[Seg::Key("default".into())], false, &at)?;
                }
            }
        }
        if let (Some(blocks), Some(k)) = (blocks, resume) {
            self.schema_blocks(m, ast, blocks, k, false, &at)?;
        }
        Ok(())
    }

    /// `traverseSchemaBlocks` from entry `start`. With `pause`, stops at the first `@theme` and
    /// returns its index.
    fn schema_blocks(
        &mut self,
        m: usize,
        ast: &JsonNode,
        blocks: &Value,
        start: usize,
        pause: bool,
        at: &dyn Fn(Loc) -> Range,
    ) -> Result<Option<usize>, String> {
        for (k, (i, block_def)) in js::entries(blocks)?.iter().enumerate().skip(start) {
            let Some(type_property) =
                type_property(ast.at_path(&[PathSeg::Key("blocks"), PathSeg::Key(i)]))?
            else {
                continue;
            };
            let source_range = at(type_property.loc);
            match js::get(block_def, "type")? {
                Some(Value::String(t)) if t == "@theme" => {
                    if pause {
                        return Ok(Some(k));
                    }
                    let names = self.theme_block_names()?;
                    for name in names.iter().filter(|n| !n.starts_with('_')) {
                        let block = self
                            .g
                            .theme_block_module(&path::basename(name, Some(".liquid")));
                        self.link(m, block, Some(source_range), RefType::Indirect);
                    }
                }
                Some(Value::String(t)) if t == "@app" => {}
                t => {
                    let block = self.g.theme_block_module(&js::opt_to_string(t));
                    self.link(m, block, Some(source_range), RefType::Direct);
                }
            }
        }
        Ok(None)
    }

    /// The blocks loop of `traverseSchemaPresets` and `traverseSchemaDefault`, and
    /// `traverseSchemaPresetBlock` (`recurse`).
    fn preset_blocks(
        &mut self,
        m: usize,
        ast: &JsonNode,
        blocks: &Value,
        parent: &[Seg],
        recurse: bool,
        at: &dyn Fn(Loc) -> Range,
    ) -> Result<(), String> {
        // `Array.isArray(blocks) ? blocks.entries() : Object.entries(blocks)`: number vs string keys.
        let entries: Vec<(Seg, Value)> = match blocks {
            Value::Array(a) => a
                .iter()
                .enumerate()
                .map(|(i, b)| (Seg::Index(i), b.clone()))
                .collect(),
            _ => js::entries(blocks)?
                .into_iter()
                .map(|(k, b)| (Seg::Key(k), b))
                .collect(),
        };
        for (key, block) in entries {
            let mut node_path = parent.to_vec();
            node_path.extend([Seg::Key("blocks".into()), key]);
            let block_type = js::get(&block, "type")?;
            let target = self.g.theme_block_module(&js::opt_to_string(block_type));
            let Some(type_property) = type_property(ast.at_path(&segs(&node_path)))? else {
                continue;
            };
            self.link(m, target, Some(at(type_property.loc)), RefType::Preset);
            if recurse {
                if let Some(children) = truthy_get(&block, "blocks")? {
                    self.preset_blocks(m, ast, children, &node_path, true, at)?;
                }
            }
        }
        Ok(())
    }

    fn theme_block_names(&mut self) -> Result<Vec<String>, String> {
        let fs = self.deps.fs;
        let blocks = path::join(&self.deps.root_uri, &["blocks"]);
        self.theme_block_names
            .get_or_insert_with(|| {
                let uris = recursive_read_directory(fs, &blocks, &|uri| uri.ends_with(".liquid"))?;
                Ok(uris
                    .iter()
                    .map(|uri| path::basename(uri, Some(".liquid")))
                    .collect())
            })
            .clone()
    }

    /// `traverseJsonModule`: templates and section groups.
    fn traverse_json(&mut self, m: usize) -> Result<(), String> {
        let uri = self.g.all[m].uri.clone();
        let deps = self.deps;
        let text;
        let local;
        let sc: &SourceCode = match self.theme_files.get(uri.as_str()) {
            Some(&i) => &deps.theme[i],
            None => {
                text = deps.fs.read_file(&uri)?;
                local = to_source_code(&uri, &text);
                &local
            }
        };
        let Some(ast) = sc.json_ast() else {
            return Ok(());
        };
        let pos = |byte: usize| sc.position(byte).index as usize;

        let template = parse_json(sc.source).ok_or_else(|| undefined_read("sections"))?;
        let sections =
            js::get(&template, "sections")?.ok_or("Cannot convert undefined or null to object")?;
        let mut with_blocks = Vec::new();
        for (key, section) in js::entries(sections)? {
            let section_type = js::get(&section, "type")?;
            let path = vec!["sections".to_string(), key];
            let target = self.g.section_module(&js::opt_to_string(section_type));
            let type_property =
                type_property(ast.at_path(&keys(&path)))?.ok_or_else(|| undefined_read("loc"))?;
            self.link(
                m,
                target,
                Some((pos(type_property.loc.start), pos(type_property.loc.end))),
                RefType::Direct,
            );
            // `traverseSectionReferences` binds after `await acceptsLocalBlocks(...)`.
            if js::get(&section, "blocks")?.is_some_and(truthy) {
                with_blocks.push((path, section));
            }
        }

        if self.g.all[m].kind == ModuleKind::Template {
            // The layout reference is always 'indirect'.
            let layout = js::get(&template, "layout")?;
            let layout_name = match layout {
                Some(Value::Bool(false)) => None,
                None => Some("theme".to_string()),
                Some(v) => Some(js::to_string(v)),
            };
            if let Some(name) = layout_name {
                let target = self.g.layout_module(&name);
                let source_range = match layout {
                    None => None,
                    Some(_) => {
                        let node = ast
                            .at_path(&[PathSeg::Key("layout")])
                            .ok_or_else(|| undefined_read("loc"))?;
                        Some((pos(node.loc().start), pos(node.loc().end)))
                    }
                };
                self.link(m, target, source_range, RefType::Indirect);
            }
        }

        for (path, section) in with_blocks {
            if self.accepts_local_blocks(js::get(&section, "type")?.and_then(Value::as_str))? {
                continue;
            }
            let blocks = js::get(&section, "blocks")?.unwrap();
            self.block_references(m, ast, &pos, &path, blocks)?;
        }
        Ok(())
    }

    /// `traverseSectionReferences`' loop and `traverseBlockReferences`: depth first.
    fn block_references(
        &mut self,
        m: usize,
        ast: &JsonNode,
        pos: &dyn Fn(usize) -> usize,
        parent: &[String],
        blocks: &Value,
    ) -> Result<(), String> {
        for (key, block) in js::entries(blocks)? {
            let block_type = js::get(&block, "type")?;
            let target = self.g.theme_block_module(&js::opt_to_string(block_type));
            let mut path = parent.to_vec();
            path.extend(["blocks".to_string(), key]);
            let type_property =
                type_property(ast.at_path(&keys(&path)))?.ok_or_else(|| undefined_read("loc"))?;
            self.link(
                m,
                target,
                Some((pos(type_property.loc.start), pos(type_property.loc.end))),
                RefType::Direct,
            );
            if let Some(children) = truthy_get(&block, "blocks")? {
                self.block_references(m, ast, pos, &path, children)?;
            }
        }
        Ok(())
    }
}

/// `serializeThemeGraph(graph)` as JSON.
pub fn serialize_theme_graph(graph: &ThemeGraph) -> Value {
    let location = |l: &Location| match l.range {
        Some((s, e)) => json!({ "uri": l.uri, "range": [s, e] }),
        None => json!({ "uri": l.uri }),
    };
    let nodes: Vec<Value> = graph
        .modules()
        .map(|m| json!({ "uri": m.uri, "type": m.module_type.as_str(), "kind": m.kind.as_str(), "exists": m.exists }))
        .collect();
    let edges: Vec<Value> = graph
        .modules()
        .flat_map(|m| &m.dependencies)
        .map(|r| json!({ "source": location(&r.source), "target": location(&r.target), "type": r.ref_type.as_str() }))
        .collect();
    json!({ "rootUri": graph.root_uri, "nodes": nodes, "edges": edges })
}

impl Deps<'_> {
    /// theme-check-node's `getReferences(uri)`: `themeGraph.modules[uri]?.references ?? []`.
    /// `None` when the dep is `undefined`.
    pub fn get_references(&self, uri: &str) -> Option<Cow<'_, [Reference]>> {
        self.graph_lookup("getReferences", uri, |m| &m.references)
    }

    /// theme-check-node's `getDependencies(uri)`: `themeGraph.modules[uri]?.dependencies ?? []`.
    pub fn get_dependencies(&self, uri: &str) -> Option<Cow<'_, [Reference]>> {
        self.graph_lookup("getDependencies", uri, |m| &m.dependencies)
    }

    fn graph_lookup(
        &self,
        dep: &str,
        uri: &str,
        refs: fn(&ThemeModule) -> &Vec<Reference>,
    ) -> Option<Cow<'_, [Reference]>> {
        if self.is_mocked(dep) {
            // ponytail: a stated throw answers `[]` (no spec states one).
            let recorded = match self.recorded(dep, None, &json!([uri])) {
                Some(Ok(Value::Array(a))) => a.iter().filter_map(reference_from_json).collect(),
                _ => Vec::new(),
            };
            return Some(Cow::Owned(recorded));
        }
        Some(match self.theme_graph.as_ref()? {
            Ok(graph) => graph.module(uri).map_or(Cow::Borrowed(&[][..]), |m| {
                Cow::Borrowed(refs(m).as_slice())
            }),
            Err(_) => Cow::Borrowed(&[]),
        })
    }
}

/// A recorded `Reference`: `{ source: { uri, range? }, target: { uri, range? }, type }`.
fn reference_from_json(v: &Value) -> Option<Reference> {
    let location = |l: &Value| {
        let range = l
            .get("range")
            .and_then(Value::as_array)
            .and_then(|r| Some((r.first()?.as_u64()? as usize, r.get(1)?.as_u64()? as usize)));
        Some(Location {
            uri: l.get("uri")?.as_str()?.to_string(),
            range,
        })
    };
    let ref_type = match v.get("type")?.as_str()? {
        "direct" => RefType::Direct,
        "indirect" => RefType::Indirect,
        "preset" => RefType::Preset,
        _ => return None,
    };
    Some(Reference {
        source: location(v.get("source")?)?,
        target: location(v.get("target")?)?,
        ref_type,
    })
}

/// utils/traversal.ts `getAncestorUris(uri, getReferences)`: BFS up direct references.
pub fn get_ancestor_uris(deps: &Deps, uri: &str) -> Vec<String> {
    let mut ancestors = Vec::new();
    let mut visited = HashSet::new();
    let mut queue = VecDeque::from([uri.to_string()]);
    while let Some(current) = queue.pop_front() {
        if !visited.insert(current.clone()) {
            continue;
        }
        for r in deps.get_references(&current).unwrap_or_default().iter() {
            if r.ref_type == RefType::Direct && !visited.contains(&r.source.uri) {
                ancestors.push(r.source.uri.clone());
                queue.push_back(r.source.uri.clone());
            }
        }
    }
    ancestors
}

/// utils/traversal.ts `getRenderedSnippetUris(uri, getDependencies)`
pub fn get_rendered_snippet_uris(deps: &Deps, uri: &str) -> Vec<String> {
    let deps = deps.get_dependencies(uri).unwrap_or_default();
    deps.iter()
        .filter(|d| d.ref_type == RefType::Direct && is_snippet(&d.target.uri))
        .map(|d| d.target.uri.clone())
        .collect()
}

/// utils/traversal.ts `getAllSnippetDescendantUris(initialUris, getDependencies)`: BFS down direct
/// snippet dependencies, including the initial uris.
pub fn get_all_snippet_descendant_uris(deps: &Deps, initial: Vec<String>) -> Vec<String> {
    let mut result = Vec::new();
    let mut visited = HashSet::new();
    let mut queue = VecDeque::from(initial);
    while let Some(current) = queue.pop_front() {
        if !visited.insert(current.clone()) {
            continue;
        }
        for d in deps.get_dependencies(&current).unwrap_or_default().iter() {
            if d.ref_type == RefType::Direct
                && is_snippet(&d.target.uri)
                && !visited.contains(&d.target.uri)
            {
                queue.push_back(d.target.uri.clone());
            }
        }
        result.push(current);
    }
    result
}
