use super::block_tag_syntax::valid_block_markup;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static UNRECOGNIZED_BLOCK_ARGUMENTS: CheckDef = CheckDef {
    code: "UnrecognizedBlockArguments",
    name: "Unrecognized Block Arguments",
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
        NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        let Some(markup) = valid_block_markup(tag, cx.source()) else {
            return Ok(());
        };
        let Some(parameters) = cx.get_block_parameters(&markup.name.value) else {
            return Ok(());
        };
        for arg in markup
            .args
            .iter()
            .filter(|a| a.name != "block.name" && parameters.get(&a.name).is_none())
        {
            let message = format!(
                "Unknown argument '{}' in block tag for '{}'.",
                arg.name, markup.name.value
            );
            cx.report(message, arg.position.start, arg.position.end);
        }
        Ok(())
    }
}
