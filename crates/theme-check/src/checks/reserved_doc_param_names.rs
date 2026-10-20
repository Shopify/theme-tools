use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};
use liquid_parser::LIQUID_LITERAL_KEYWORDS;

pub static RESERVED_DOC_PARAM_NAMES: CheckDef = CheckDef {
    code: "ReservedDocParamNames",
    name: "Valid doc parameter names",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidDocParamNode.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidDocParamNode(node) = node else {
            return Ok(());
        };
        let name = &node.param_name;
        if LIQUID_LITERAL_KEYWORDS.contains(&&*name.value) {
            let message = format!(
                "The parameter name '{}' is reserved because Liquid parses it as a literal.",
                name.value
            );
            cx.report(message, name.position.start, name.position.end);
        }
        Ok(())
    }
}
