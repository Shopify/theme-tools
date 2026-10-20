use super::args_utils::{
    get_block_name, get_liquid_doc_params, report_unknown_arguments, ArgsTag, CLOSEST_ARGUMENT,
    REQUIRED_CONTENT_FOR_ARGUMENTS, RESERVED_CONTENT_FOR_ARGUMENTS,
};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static UNRECOGNIZED_CONTENT_FOR_ARGUMENTS: CheckDef = CheckDef {
    code: "UnrecognizedContentForArguments",
    name: "Unrecognized ContentFor Arguments",
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
        let Some(params) = get_liquid_doc_params(cx, &format!("blocks/{name}.liquid")) else {
            return Ok(());
        };
        let unknown = node.args.iter().filter(|a| {
            !params.has(&a.name)
                && !RESERVED_CONTENT_FOR_ARGUMENTS.contains(&&*a.name)
                && !REQUIRED_CONTENT_FOR_ARGUMENTS.contains(&&*a.name)
                && !a.name.starts_with(CLOSEST_ARGUMENT)
        });
        report_unknown_arguments(
            cx,
            ArgsTag::ContentFor,
            node.position,
            &node.args,
            unknown,
            name,
        );
        Ok(())
    }
}
