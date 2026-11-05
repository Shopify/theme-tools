use super::args_utils::{
    get_liquid_doc_params, get_snippet_name, report_unknown_arguments, ArgsTag,
};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use liquid_ast::{NodeKind, NodeRef};

pub static UNRECOGNIZED_RENDER_SNIPPET_ARGUMENTS: CheckDef = CheckDef {
    code: "UnrecognizedRenderSnippetArguments",
    name: "Unrecognized Render Snippet Arguments",
    aliases: &["UnrecognizedRenderSnippetParams"],
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

        // reportUnknownAliases
        if let (Some(alias), Some(variable)) = (&node.alias, &node.variable) {
            if !params.has(&alias.value) {
                let message = format!(
                    "Unknown argument '{}' in render tag for snippet '{name}'.",
                    alias.value
                );
                // `variable.position.start - 1`: the space before, which can be non-ASCII.
                let before = cx.source()[..variable.position.start]
                    .char_indices()
                    .next_back()
                    .map_or(0, |(i, _)| i);
                let suggest = vec![Suggestion::new(
                    format!("Remove '{}'", alias.value),
                    Fix::remove(before, alias.position.end),
                )];
                cx.report_with(
                    message,
                    variable.position.start,
                    alias.position.end,
                    None,
                    Some(suggest),
                );
            }
        }
        report_unknown_arguments(
            cx,
            ArgsTag::Render,
            node.position,
            &node.args,
            node.args.iter().filter(|a| !params.has(&a.name)),
            name,
        );
        Ok(())
    }
}
