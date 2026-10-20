use super::args_utils::{get_snippet_name, report_duplicate_arguments, ArgsTag};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static DUPLICATE_RENDER_SNIPPET_ARGUMENTS: CheckDef = CheckDef {
    code: "DuplicateRenderSnippetArguments",
    name: "Duplicate Render Snippet Arguments",
    aliases: &["DuplicateRenderSnippetParams"],
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
        NodeKind::RenderMarkup.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::RenderMarkup(node) = node else {
            return Ok(());
        };
        let Some(name) = get_snippet_name(node) else {
            return Ok(());
        };
        let alias = node
            .alias
            .as_ref()
            .map(|a| &*a.value)
            .filter(|a| !a.is_empty());
        report_duplicate_arguments(cx, ArgsTag::Render, node.position, alias, &node.args, name);
        Ok(())
    }
}
