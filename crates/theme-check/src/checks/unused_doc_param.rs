use super::utils::is_loop_scoped_variable;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use liquid_ast::{LiquidDocParamNode, NodeKind, NodeRef};
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
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidDocParamNode.bit() | NodeKind::VariableLookup.bit()
    }

    fn node(
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

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        for &(variable, node) in &self.defined {
            if !self.used.contains(variable) {
                let message =
                    format!("The parameter '{variable}' is defined but not used in this file.");
                let fix = Fix::remove(node.position.start, node.position.end);
                let suggest = vec![Suggestion::new(
                    format!("Remove unused parameter '{variable}'"),
                    fix,
                )];
                cx.report_with(
                    message,
                    node.position.start,
                    node.position.end,
                    None,
                    Some(suggest),
                );
            }
        }
        Ok(())
    }
}
