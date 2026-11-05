use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};
use std::collections::HashSet;

pub static UNIQUE_DOC_PARAM_NAMES: CheckDef = CheckDef {
    code: "UniqueDocParamNames",
    name: "Unique doc parameter names",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

#[derive(Default)]
struct Check<'a> {
    defined: HashSet<&'a str>,
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidDocParamNode.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidDocParamNode(node) = node else {
            return Ok(());
        };
        let name = &node.param_name;
        if !self.defined.insert(&name.value) {
            cx.report(
                format!("The parameter '{}' is defined more than once.", name.value),
                name.position.start,
                name.position.end,
            );
        }
        Ok(())
    }
}
