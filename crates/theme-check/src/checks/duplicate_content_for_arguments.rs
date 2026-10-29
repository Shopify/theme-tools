use super::args_utils::{get_block_name, report_duplicate_arguments, ArgsTag};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static DUPLICATE_CONTENT_FOR_ARGUMENTS: CheckDef = CheckDef {
    code: "DuplicateContentForArguments",
    name: "Duplicate ContentFor Arguments",
    aliases: &[],
    severity: Severity::Warning,
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
        NodeKind::ContentForMarkup.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::ContentForMarkup(node) = node else {
            return Ok(());
        };
        let Some(name) = get_block_name(node) else {
            return Ok(());
        };
        report_duplicate_arguments(
            cx,
            ArgsTag::ContentFor,
            node.position,
            None,
            &node.args,
            name,
        );
        Ok(())
    }
}
