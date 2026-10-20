use super::styles::{
    collect_used_classes, collect_used_classes_from_svg, extract_css_class_names, UsedClass,
};
use crate::context::{
    CheckDef, CheckResult, Context, Create, Deps, LiquidCheck, ScopedCssClasses, Severity,
};
use crate::graph::{
    get_all_snippet_descendant_uris, get_ancestor_uris, get_rendered_snippet_uris,
    recursive_read_directory,
};
use liquid_ast::{NodeKind, NodeRef};
use std::collections::{HashMap, HashSet};

pub static VALID_SCOPED_CSS_CLASS: CheckDef = CheckDef {
    code: "ValidScopedCSSClass",
    name: "Validates CSS classes used in class attributes are defined in an in-scope stylesheet",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check<'a> {
    local_css_classes: HashSet<String>,
    used_classes: Vec<UsedClass<'a>>,
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check {
        local_css_classes: HashSet::new(),
        used_classes: Vec::new(),
    }))
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidRawTag.bit()
            | NodeKind::HtmlElement.bit()
            | NodeKind::HtmlVoidElement.bit()
            | NodeKind::HtmlSelfClosingElement.bit()
            | NodeKind::HtmlRawNode.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let source = cx.source();
        let used = &mut self.used_classes;
        match node {
            NodeRef::LiquidRawTag(n) if n.name == "stylesheet" => self
                .local_css_classes
                .extend(extract_css_class_names(&n.body.value)),
            NodeRef::HtmlElement(n) => collect_used_classes(&n.attributes, source, 0, used),
            NodeRef::HtmlVoidElement(n) => collect_used_classes(&n.attributes, source, 0, used),
            NodeRef::HtmlSelfClosingElement(n) => {
                collect_used_classes(&n.attributes, source, 0, used)
            }
            NodeRef::HtmlRawNode(n) if n.name == "svg" => collect_used_classes_from_svg(
                &n.attributes,
                source,
                &n.body.value,
                n.body.position.start,
                used,
            ),
            _ => {}
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        if self.used_classes.is_empty() {
            return Ok(());
        }
        let deps = cx.deps;
        let uri = cx.file.uri.as_str();
        if deps.get_references(uri).is_none() || deps.get_dependencies(uri).is_none() {
            return Ok(());
        }
        let Some(css) = deps
            .scoped_css_classes
            .get_or_init(|| ScopedCssClasses::new(deps))
        else {
            return Ok(());
        };

        // Only classes that some theme file defines (7) and that aren't local or in an asset (1)
        // can be reported, so the graph walk only runs when there are some. Same output.
        let candidates: Vec<_> = self
            .used_classes
            .iter()
            .filter(|(c, ..)| {
                css.all.contains(*c)
                    && !self.local_css_classes.contains(*c)
                    && !css.assets.contains(*c)
            })
            .collect();
        if candidates.is_empty() {
            return Ok(());
        }

        // 2. Ancestors. 4-5. Snippets rendered by this file or an ancestor, and their descendants.
        let ancestors = get_ancestor_uris(deps, uri);
        let rendered = std::iter::once(uri)
            .chain(ancestors.iter().map(String::as_str))
            .flat_map(|u| get_rendered_snippet_uris(deps, u))
            .collect();
        let snippets = get_all_snippet_descendant_uris(deps, rendered);

        // 3, 6. Their stylesheets.
        let (hits, misses): (Vec<&String>, Vec<&String>) = ancestors
            .iter()
            .chain(&snippets)
            .partition(|u| css.per_uri.contains_key(u.as_str()));
        let fetched: Vec<HashSet<String>> = misses
            .iter()
            .map(|u| deps.get_css_classes_for_uri(u).unwrap_or_default())
            .collect();
        let scope: Vec<&HashSet<String>> = hits
            .iter()
            .map(|u| &css.per_uri[u.as_str()])
            .chain(&fetched)
            .collect();

        // 8.
        for &&(class, start, end) in &candidates {
            if !scope.iter().any(|classes| classes.contains(class)) {
                cx.report(
                    format!("CSS class '{class}' may be defined outside the scope of this file."),
                    start,
                    end,
                );
            }
        }
        Ok(())
    }
}

impl ScopedCssClasses {
    fn new(deps: &Deps) -> Option<Self> {
        deps.get_css_classes_for_uri(&deps.root_uri)?; // is `getCSSClassesForURI` defined?
        let mut per_uri = HashMap::new();
        let mut add = |u: String, union: &mut HashSet<String>| {
            let classes = deps.get_css_classes_for_uri(&u).unwrap_or_default();
            union.extend(classes.iter().cloned());
            per_uri.insert(u, classes);
        };
        // getAssetCSSClasses
        let mut assets = HashSet::new();
        for (u, _) in deps
            .fs
            .read_directory(&deps.to_uri("assets"))
            .unwrap_or_default()
        {
            if u.ends_with(".css") {
                add(u, &mut assets);
            }
        }
        // getAllThemeCSSClasses
        let mut all = assets.clone();
        for u in recursive_read_directory(deps.fs, &deps.to_uri(""), &|u| u.ends_with(".liquid"))
            .unwrap_or_default()
        {
            add(u, &mut all);
        }
        Some(ScopedCssClasses {
            per_uri,
            assets,
            all,
        })
    }
}
