use super::args_utils::get_snippet_name;
use super::utils::is_loop_scoped_variable;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use crate::graph::RefType;
use crate::schema::is_snippet;
use liquid_ast::{visit_liquid, LiquidDocParamNode, NodeKind, NodeRef};
use std::collections::HashSet;

pub static UNUSED_DOC_PARAM: CheckDef = CheckDef {
    code: "UnusedDocParam",
    name: "Prevent unused doc parameters",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

#[derive(Default)]
struct Check<'a> {
    /// Map insertion order; a redefinition keeps its slot and takes the new node.
    defined: Vec<(&'a str, &'a LiquidDocParamNode<'a>)>,
    used: HashSet<&'a str>,
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn kinds(&self) -> &'static [NodeKind] {
        &[NodeKind::LiquidDocParamNode, NodeKind::VariableLookup]
    }

    fn enter(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        _: &mut Context<'a>,
    ) -> CheckResult {
        match node {
            NodeRef::LiquidDocParamNode(node) => {
                let name = &*node.param_name.value;
                match self.defined.iter_mut().find(|(n, _)| *n == name) {
                    Some(slot) => slot.1 = node,
                    None => self.defined.push((name, node)),
                }
            }
            NodeRef::VariableLookup(v) => {
                if let Some(name) = v.name.as_deref().filter(|n| !n.is_empty()) {
                    if !is_loop_scoped_variable(name, ancestors) {
                        self.used.insert(name);
                    }
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let has_used_optional_param = self
            .defined
            .iter()
            .any(|(variable, node)| !node.required && self.used.contains(variable));
        let provided = if has_used_optional_param {
            provided_params(cx)
        } else {
            None
        };
        for &(variable, node) in &self.defined {
            if !self.used.contains(variable) {
                let message =
                    format!("The parameter '{variable}' is defined but not used in this file.");
                let fix = Fix::remove(node.span.start, node.span.end);
                let suggest = vec![Suggestion::new(
                    format!("Remove unused parameter '{variable}'"),
                    fix,
                )];
                cx.report_with(message, node.span, None, Some(suggest));
            } else if !node.required && provided.as_ref().is_some_and(|p| !p.contains(variable)) {
                let message =
                    format!("The parameter '{variable}' is never passed to this snippet.");
                cx.report(message, node.span);
            }
        }
        Ok(())
    }
}

/// The parameters that the snippet's `render` callers pass to it. `None` when that can't be
/// known: the snippet has no callers, a caller can't be read, or a caller uses `include`.
fn provided_params(cx: &Context) -> Option<HashSet<String>> {
    let uri = cx.file.uri.as_str();
    if !is_snippet(uri) {
        return None;
    }
    let references = cx.deps.get_references(uri)?;
    let relative_path = cx.to_relative_path(uri);
    let snippet_name = relative_path
        .strip_prefix("snippets/")
        .unwrap_or(&relative_path);
    let snippet_name = snippet_name.strip_suffix(".liquid").unwrap_or(snippet_name);

    let mut source_uris: Vec<&str> = Vec::new();
    for r in references.iter().filter(|r| r.ref_type == RefType::Direct) {
        if !source_uris.contains(&r.source.uri.as_str()) {
            source_uris.push(&r.source.uri);
        }
    }
    // A snippet without callers is OrphanedSnippet's to report.
    if source_uris.is_empty() {
        return None;
    }

    let mut provided = HashSet::new();
    for source_uri in source_uris {
        let source = cx.deps.fs.read_file(source_uri).ok()?;
        if !source_uri.ends_with(".liquid") {
            return None;
        }
        let doc = liquid_parser::parse(&source).ok()?;
        let mut has_include_caller = false;
        visit_liquid(NodeRef::Document(&doc), |node, ancestors, exiting| {
            let NodeRef::RenderMarkup(node) = node else {
                return;
            };
            if exiting || get_snippet_name(node) != Some(snippet_name) {
                return;
            }
            if matches!(ancestors.last(), Some(NodeRef::LiquidTag(t)) if t.name == "include") {
                has_include_caller = true;
                return;
            }
            provided.extend(node.args.iter().map(|a| a.name.to_string()));
            if node.variable.is_some() {
                let name = node.alias.as_ref().map_or(snippet_name, |a| &*a.value);
                provided.insert(name.to_string());
            }
        });
        // Includes inherit their caller's variables, so explicit arguments alone can't show
        // that a documented parameter is never supplied.
        if has_include_caller {
            return None;
        }
    }
    Some(provided)
}
