use super::utils::is_within_raw_tag_that_does_not_parse_its_contents;
use crate::block_parameters::BLOCK_CONTENT_PARAMETER;
use crate::context::{
    CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Mode, Severity,
};
use crate::docset::ThemeDocset;
use crate::liquid_doc::has_liquid_doc;
use crate::path;
use crate::schema::is_block;
use liquid_ast::{Markup, Node, NodeKind, NodeRef, Position, VariableLookup};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub static UNDEFINED_OBJECT: CheckDef = CheckDef {
    code: "UndefinedObject",
    name: "Undefined Object",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

/// TS `{ start?: number; end?: number }`: 0 stands for `undefined` (both are falsy) and -1 for an
/// unclosed tag's `{ start: -1, end: -1 }`.
#[derive(Clone, Copy)]
struct Scope {
    start: i64,
    end: i64,
}

struct Check<'a> {
    relative_path: String,
    docset: &'a ThemeDocset,
    scoped_variables: HashMap<&'a str, Vec<Scope>>,
    file_scoped_variables: HashSet<&'a str>,
    variables: Vec<&'a VariableLookup<'a>>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let relative_path = cx.to_relative_path(cx.uri());
    let ast = cx.file.liquid_ast()?;
    // Skip snippets without doc tags.
    if relative_path.starts_with("snippets/") && !has_liquid_doc(ast) {
        return None;
    }
    // Skip when definitions for global objects are unavailable.
    let docset = cx.docset()?;
    let mut file_scoped_variables = HashSet::new();
    // builtInVariables: theme blocks always receive `content`.
    if relative_path.starts_with("blocks/") {
        file_scoped_variables.insert(BLOCK_CONTENT_PARAMETER);
    }
    Some(Box::new(Check {
        relative_path,
        docset,
        scoped_variables: HashMap::new(),
        file_scoped_variables,
        variables: Vec::new(),
    }))
}

fn offset(p: usize) -> i64 {
    if p == usize::MAX {
        -1
    } else {
        p as i64
    }
}

/// `blockEndPosition?.<field>`
fn block_end(p: Option<Position>, start: bool) -> i64 {
    p.map_or(0, |p| offset(if start { p.start } else { p.end }))
}

impl<'a> Check<'a> {
    fn index_variable_scope(&mut self, name: Option<&'a str>, scope: Scope) {
        if let Some(name) = name.filter(|n| !n.is_empty()) {
            self.scoped_variables.entry(name).or_default().push(scope);
        }
    }

    /// `isDefined(...)`
    fn is_defined(&self, name: &str, position: Position) -> bool {
        if self.file_scoped_variables.contains(name) {
            return true;
        }
        let Some(scopes) = self.scoped_variables.get(name) else {
            return false;
        };
        let start = position.start as i64;
        scopes
            .iter()
            .any(|s| (s.start == 0 || start > s.start) && (s.end == 0 || start < s.end))
    }
}

/// `getContextualObjects(relativePath, mode)`
fn contextual_objects(relative_path: &str, mode: Mode) -> &'static [&'static str] {
    const BLOCK_CONTEXTUAL_OBJECTS: &[&str] = &["app", "section", "recommendations", "block"];
    if relative_path.starts_with("layout/checkout.liquid") {
        &[
            "locale",
            "direction",
            "skip_to_content_link",
            "checkout_html_classes",
            "checkout_stylesheets",
            "checkout_scripts",
            "content_for_logo",
            "breadcrumb",
            "order_summary_toggle",
            "content_for_order_summary",
            "alternative_payment_methods",
            "content_for_footer",
            "tracking_code",
        ]
    } else if relative_path.starts_with("sections/") {
        &["section", "predictive_search", "recommendations", "comment"]
    } else if relative_path.starts_with("blocks/") {
        BLOCK_CONTEXTUAL_OBJECTS
    } else if relative_path.starts_with("snippets/") {
        // Theme app extension snippets are only rendered from blocks; theme snippets get `section`
        // and `block` from the section or block that renders them.
        if mode == Mode::App {
            BLOCK_CONTEXTUAL_OBJECTS
        } else {
            &["app", "section", "block"]
        }
    } else {
        &[]
    }
}

/// The `globalObjects` filter for one `ObjectEntry`.
fn is_global_object(entry: &Value, contextual: &[&str]) -> Result<bool, CheckError> {
    let name = entry.get("name").and_then(Value::as_str);
    if name.is_some_and(|n| contextual.contains(&n)) {
        return Ok(true);
    }
    let access = match entry.get("access") {
        None => return Ok(true),
        Some(a) if !crate::json::truthy(a) => return Ok(true),
        Some(a) => a,
    };
    if access.get("global") == Some(&Value::Bool(true)) {
        return Ok(true);
    }
    // `access.template.length > 0`
    match access.get("template") {
        Some(Value::Array(t)) => Ok(!t.is_empty()),
        Some(Value::String(t)) => Ok(!t.is_empty()),
        Some(Value::Null) => Err(CheckError::new(
            "Cannot read properties of null (reading 'length')",
        )),
        None => Err(CheckError::new(
            "Cannot read properties of undefined (reading 'length')",
        )),
        Some(Value::Object(o)) => Ok(o
            .get("length")
            .and_then(Value::as_f64)
            .is_some_and(|l| l > 0.0)),
        Some(_) => Ok(false),
    }
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidDocParamNode.bit()
            | NodeKind::LiquidTag.bit()
            | NodeKind::VariableLookup.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        _: &mut Context<'a>,
    ) -> CheckResult {
        match node {
            NodeRef::LiquidDocParamNode(node) => {
                if !node.param_name.value.is_empty() {
                    self.file_scoped_variables.insert(&node.param_name.value);
                }
            }
            NodeRef::LiquidTag(node) => {
                if is_within_raw_tag_that_does_not_parse_its_contents(ancestors) {
                    return Ok(());
                }
                let markup = match &node.markup {
                    Markup::Node(m) => Some(m.as_ref()),
                    _ => None,
                };
                let block_start_end = offset(node.block_start_position.end);
                let scope_end = block_end(node.block_end_position, true);
                match (&*node.name, markup) {
                    ("assign", Some(Node::AssignMarkup(m))) => {
                        self.index_variable_scope(
                            Some(&m.name),
                            Scope {
                                start: block_start_end,
                                end: 0,
                            },
                        );
                    }
                    ("capture", Some(Node::VariableLookup(v))) => {
                        let start = block_end(node.block_end_position, false);
                        self.index_variable_scope(v.name.as_deref(), Scope { start, end: 0 });
                    }
                    // {% form 'cart', cart %}{{ form }}{% endform %}
                    ("form" | "paginate", _) => {
                        self.index_variable_scope(
                            Some(&node.name),
                            Scope {
                                start: block_start_end,
                                end: scope_end,
                            },
                        );
                    }
                    // {% layout none %}
                    ("layout", _) => {
                        let p = node.position;
                        self.index_variable_scope(
                            Some("none"),
                            Scope {
                                start: offset(p.start),
                                end: offset(p.end),
                            },
                        );
                    }
                    // {% increment var %}
                    ("increment" | "decrement", Some(Node::VariableLookup(v))) => {
                        let start = offset(node.position.start);
                        self.index_variable_scope(v.name.as_deref(), Scope { start, end: 0 });
                    }
                    // {% for x in y %}{{ forloop }}{{ x }}{% endfor %}
                    ("for" | "tablerow", Some(Node::ForMarkup(m))) => {
                        let scope = Scope {
                            start: block_start_end,
                            end: scope_end,
                        };
                        self.index_variable_scope(Some(&m.variable_name), scope);
                        let loop_name = if node.name == "for" {
                            "forloop"
                        } else {
                            "tablerowloop"
                        };
                        self.index_variable_scope(Some(loop_name), scope);
                    }
                    _ => {}
                }
            }
            NodeRef::VariableLookup(v) => {
                if is_within_raw_tag_that_does_not_parse_its_contents(ancestors) {
                    return Ok(());
                }
                if matches!(ancestors.last(), Some(NodeRef::LiquidTag(t)) if t.name == "capture") {
                    return Ok(());
                }
                self.variables.push(v);
            }
            _ => {}
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let contextual = contextual_objects(&self.relative_path, cx.mode());
        for entry in &self.docset.objects {
            if is_global_object(entry, contextual)? {
                if let Some(name) = entry.get("name").and_then(Value::as_str) {
                    self.file_scoped_variables.insert(name);
                }
            }
        }
        // themeBlockParameterNames
        if is_block(cx.uri()) {
            if let Some(parameters) =
                cx.get_block_parameters(&path::basename(cx.uri(), Some(".liquid")))
            {
                self.file_scoped_variables
                    .extend(parameters.iter().map(|p| p.name.as_str()));
            }
        }
        for v in &self.variables {
            let Some(name) = v.name.as_deref().filter(|n| !n.is_empty()) else {
                continue;
            };
            if !self.is_defined(name, v.position) {
                cx.report(
                    format!("Unknown object '{name}' used."),
                    v.position.start,
                    v.position.end,
                );
            }
        }
        Ok(())
    }
}
