use super::utils::is_within_raw_tag_that_does_not_parse_its_contents;
use crate::block_parameters::BLOCK_CONTENT_PARAMETER;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::schema::is_block;
use liquid_ast::{Node, NodeKind, NodeRef};

pub static BLOCK_CONTENT_USAGE: CheckDef = CheckDef {
    code: "BlockContentUsage",
    name: "Use `content` instead of `block.content`",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    if !is_block(cx.uri()) {
        return None;
    }
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::VariableLookup.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        let NodeRef::VariableLookup(v) = node else {
            return Ok(());
        };
        if is_within_raw_tag_that_does_not_parse_its_contents(ancestors) {
            return Ok(());
        }
        // isBlockContentLookup
        if v.name.as_deref() == Some("block")
            && matches!(v.lookups.first(), Some(Node::String(s)) if s.value == BLOCK_CONTENT_PARAMETER)
        {
            cx.report(
                "Use the implicit 'content' parameter directly instead of 'block.content'.",
                v.position.start,
                v.position.end,
            );
        }
        Ok(())
    }
}
