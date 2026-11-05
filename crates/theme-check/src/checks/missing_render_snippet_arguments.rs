use super::args_utils::{
    get_liquid_doc_params, get_snippet_name, report_missing_arguments, ArgsTag,
};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static MISSING_RENDER_SNIPPET_ARGUMENTS: CheckDef = CheckDef {
    code: "MissingRenderSnippetArguments",
    name: "Missing Render Snippet Arguments",
    aliases: &["MissingRenderSnippetParams"],
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
        let Some(params) = get_liquid_doc_params(cx, &format!("snippets/{name}.liquid")) else {
            return Ok(());
        };
        let alias = node.alias.as_ref().map(|a| &*a.value);
        let missing = params.values().filter(|p| {
            p.required && !node.args.iter().any(|a| a.name == p.name) && Some(&*p.name) != alias
        });
        report_missing_arguments(
            cx,
            ArgsTag::Render,
            node.position,
            &node.args,
            missing,
            name,
        );
        Ok(())
    }
}
