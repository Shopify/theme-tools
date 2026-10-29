use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static APP_BLOCK_VALID_TAGS: CheckDef = CheckDef {
    code: "AppBlockValidTags",
    name: "App Block Valid Tags",
    aliases: &[],
    severity: Severity::Error,
    recommended: false,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

/// `ForbiddenTag`
const FORBIDDEN_TAGS: &[&str] = &[
    "javascript",
    "stylesheet",
    "include",
    "layout",
    "section",
    "sections",
];

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidRawTag.bit() | NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        // A forbidden tag with an end tag highlights the whole block.
        let (name, start, end) = match node {
            NodeRef::LiquidRawTag(t) => (
                &t.name,
                t.block_start_position.start,
                t.block_end_position.end,
            ),
            NodeRef::LiquidTag(t) => (
                &t.name,
                t.block_start_position.start,
                t.block_end_position.unwrap_or(t.position).end,
            ),
            _ => return Ok(()),
        };
        if FORBIDDEN_TAGS.contains(&name.as_ref()) {
            cx.report(
                format!("Theme app extension blocks cannot contain '{name}' tags"),
                start,
                end,
            );
        }
        Ok(())
    }
}
