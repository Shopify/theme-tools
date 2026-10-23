use super::schema_utils::{content_for_block, string_arg};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static VALID_STATIC_BLOCK_TYPE: CheckDef = CheckDef {
    code: "ValidStaticBlockType",
    name: "Prevent use of type that is not valid for static blocks",
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
        NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        // A missing or non-string type is VariableContentForArguments' job.
        let Some(type_node) = content_for_block(tag).and_then(|m| string_arg(m, "type")) else {
            return Ok(());
        };
        let relative_path = format!("blocks/{}.liquid", type_node.value);
        if !cx.file_exists(&cx.to_uri(&relative_path)) {
            let message = format!("'{relative_path}' does not exist");
            cx.report_with(
                message,
                type_node.position.start,
                type_node.position.end,
                None,
                Some(Vec::new()),
            );
        }
        Ok(())
    }
}
