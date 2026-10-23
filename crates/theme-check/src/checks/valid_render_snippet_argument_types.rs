use super::args_utils::{
    check_argument_type, generate_type_mismatch_suggestions, get_argument_type_mismatch_message,
    get_liquid_doc_params, get_snippet_name, is_supported_named_param_type, report_type_mismatches,
    ArgumentTypeCheck,
};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static VALID_RENDER_SNIPPET_ARGUMENT_TYPES: CheckDef = CheckDef {
    code: "ValidRenderSnippetArgumentTypes",
    name: "Valid Render Snippet Argument Types",
    aliases: &["ValidRenderSnippetParamTypes"],
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

        // findAndReportAliasType
        if let (Some(alias), Some(variable)) = (&node.alias, &node.variable) {
            let expected = params
                .get(&alias.value)
                .and_then(|p| p.type_.as_deref())
                .filter(|t| !t.is_empty());
            if let Some(expected) = expected {
                let argument = variable.name.as_ref();
                // isAliasMismatch
                let mismatch = match check_argument_type(expected, argument) {
                    ArgumentTypeCheck::Incompatible => true,
                    ArgumentTypeCheck::NamedType => cx
                        .docset()
                        .map_or(true, |d| is_supported_named_param_type(d, expected)),
                    ArgumentTypeCheck::Compatible | ArgumentTypeCheck::Unchecked => false,
                };
                if mismatch {
                    let p = argument.position();
                    let message = get_argument_type_mismatch_message(
                        &alias.value,
                        expected,
                        argument,
                        cx.source(),
                    );
                    cx.report_with(
                        message,
                        p.start,
                        p.end,
                        None,
                        Some(generate_type_mismatch_suggestions(expected, p.start, p.end)),
                    );
                }
            }
        }
        report_type_mismatches(cx, params, &node.args);
        Ok(())
    }
}
