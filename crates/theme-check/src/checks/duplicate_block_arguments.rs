use super::block_tag_syntax::valid_block_markup;
use crate::block_parameters::BLOCK_CONTENT_PARAMETER;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static DUPLICATE_BLOCK_ARGUMENTS: CheckDef = CheckDef {
    code: "DuplicateBlockArguments",
    name: "Duplicate Block Arguments",
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
        let body_overrides_content = tag.children.as_ref().is_some_and(|c| !c.is_empty());
        // ponytail: scans the earlier args instead of a `seen` set, tags have a handful of args.
        for (i, arg) in markup.args.iter().enumerate() {
            let p = arg.position;
            if markup.args[..i].iter().any(|a| a.name == arg.name) {
                let message = format!(
                    "Duplicate argument '{}' in block tag for '{}'.",
                    arg.name, markup.name.value
                );
                cx.report(message, p.start, p.end);
            }
            if body_overrides_content && arg.name == BLOCK_CONTENT_PARAMETER {
                cx.report(
                    "The explicit 'content' argument has no effect because the inline block body takes precedence.",
                    p.start,
                    p.end,
                );
            }
        }
        Ok(())
    }
}
