use super::utils::is_within_raw_tag_that_does_not_parse_its_contents;
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use crate::js;
use crate::visible_if::{with_variable_lookups_in_expression, VisibleIfLookups};
use liquid_ast::{LiquidTag, Markup, Node, NodeKind, NodeRef};
use serde_json::Value;
use std::collections::HashSet;

pub static UNUSED_ASSIGN: CheckDef = CheckDef {
    code: "UnusedAssign",
    name: "Prevent unused assigns",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

#[derive(Default)]
struct Check<'a> {
    /// Map insertion order; a reassignment keeps its slot and takes the new node.
    assigned: Vec<(&'a str, &'a LiquidTag<'a>)>,
    used: HashSet<String>,
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

/// `isLiquidTagAssign(node)` / `isLiquidTagCapture(node)`: the variable name, if any.
fn assign_name<'a>(tag: &'a LiquidTag<'a>) -> Option<&'a str> {
    match (tag.name.as_ref(), &tag.markup) {
        ("assign", Markup::Node(m)) => match m.as_ref() {
            Node::AssignMarkup(a) => Some(&a.name),
            _ => None,
        },
        _ => None,
    }
}

fn is_capture(tag: &LiquidTag) -> bool {
    tag.name == "capture" && !tag.markup.is_str()
}

fn capture_name<'a>(tag: &'a LiquidTag<'a>) -> Option<&'a str> {
    if !is_capture(tag) {
        return None;
    }
    match &tag.markup {
        Markup::Node(m) => match m.as_ref() {
            Node::VariableLookup(v) => v.name.as_deref().filter(|n| !n.is_empty()),
            _ => None,
        },
        _ => None,
    }
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit() | NodeKind::VariableLookup.bit() | NodeKind::LiquidRawTag.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        match node {
            NodeRef::LiquidTag(tag) => {
                if is_within_raw_tag_that_does_not_parse_its_contents(ancestors) {
                    return Ok(());
                }
                if let Some(name) = assign_name(tag).or_else(|| capture_name(tag)) {
                    match self.assigned.iter_mut().find(|(n, _)| *n == name) {
                        Some(slot) => slot.1 = tag,
                        None => self.assigned.push((name, tag)),
                    }
                }
            }
            NodeRef::VariableLookup(v) => {
                if is_within_raw_tag_that_does_not_parse_its_contents(ancestors) {
                    return Ok(());
                }
                if matches!(ancestors.last(), Some(NodeRef::LiquidTag(t)) if is_capture(t)) {
                    return Ok(());
                }
                if let Some(name) = &v.name {
                    self.used.insert(name.to_string());
                }
            }
            NodeRef::LiquidRawTag(tag) => {
                if tag.name != "schema" || tag.body.kind != "json" {
                    return Ok(());
                }
                let Some(schema) = cx.get_schema().and_then(|s| s.valid_value()) else {
                    return Ok(());
                };
                if !js::truthy(schema) {
                    return Ok(());
                }
                let settings = match js::get(schema, "settings").map_err(CheckError)? {
                    // `for of` over `settings ?? []`; a non-empty string iterates chars, and `in` on a char throws.
                    None | Some(Value::Null) => return Ok(()),
                    Some(Value::String(s)) if s.is_empty() => return Ok(()),
                    Some(Value::Array(a)) => a,
                    Some(_) => return Err(CheckError::new("validSchema.settings is not iterable")),
                };
                for setting in settings {
                    if !js::has(setting, "visible_if").map_err(CheckError)? {
                        continue;
                    }
                    let Some(Value::String(expr)) =
                        js::get(setting, "visible_if").map_err(CheckError)?
                    else {
                        continue;
                    };
                    with_variable_lookups_in_expression(expr, |lookups| {
                        if let VisibleIfLookups::Lookups(lookups) = lookups {
                            for l in lookups {
                                if let Some(name) = l.name.as_deref().filter(|n| !n.is_empty()) {
                                    self.used.insert(name.to_string());
                                }
                            }
                        }
                    });
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        for &(variable, tag) in &self.assigned {
            if !self.used.contains(variable) && !variable.starts_with('_') {
                let p = if is_capture(tag) {
                    tag.block_start_position
                } else {
                    tag.position
                };
                let fix = Fix::remove(tag.position.start, tag.position.end);
                let suggest = vec![Suggestion::new(
                    format!("Remove the unused variable '{variable}'"),
                    fix,
                )];
                cx.report_with(
                    format!("The variable '{variable}' is assigned but not used"),
                    p.start,
                    p.end,
                    None,
                    Some(suggest),
                );
            }
        }
        Ok(())
    }
}
