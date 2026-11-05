use super::block_tag_syntax::valid_block_markup;
use crate::block_parameters::BLOCK_CONTENT_PARAMETER;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static MISSING_BLOCK_ARGUMENTS: CheckDef = CheckDef {
    code: "MissingBlockArguments",
    name: "Missing Block Arguments",
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
        let has_body = tag.children.as_ref().is_some_and(|c| !c.is_empty());
        let provided = |name: &str| {
            markup.args.iter().any(|a| a.name == name)
                || (has_body && name == BLOCK_CONTENT_PARAMETER)
        };
        for p in parameters
            .iter()
            .filter(|p| p.required && !provided(&p.name))
        {
            let message = format!(
                "Missing required argument '{}' in block tag for '{}'.",
                p.name, markup.name.value
            );
            cx.report(
                message,
                tag.block_start_position.start,
                tag.block_start_position.end,
            );
        }
        Ok(())
    }
}
