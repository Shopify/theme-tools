use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::js_number_to_string;
use liquid_ast::{NodeKind, NodeRef};

pub static LIQUID_NESTING_DEPTH: CheckDef = CheckDef {
    code: "LiquidNestingDepth",
    name: "LiquidNestingDepth",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[("maxDepth", "10")],
    create: Create::Liquid(create),
};

const NESTING_TAGS: &[&str] = &["if", "unless", "for", "case", "tablerow"];

struct Check {
    max_depth: f64,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check {
        max_depth: cx.setting_f64("maxDepth").unwrap_or(10.0),
    }))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        if !NESTING_TAGS.contains(&tag.name.as_ref()) {
            return Ok(());
        }
        let depth = 1 + ancestors
            .iter()
            .filter(
                |a| matches!(a, NodeRef::LiquidTag(t) if NESTING_TAGS.contains(&t.name.as_ref())),
            )
            .count();
        if depth as f64 <= self.max_depth {
            return Ok(());
        }
        let p = tag.block_start_position;
        cx.report(
            format!(
                "This Liquid block is nested {depth} levels deep, which exceeds the maximum allowed depth of {}.",
                js_number_to_string(self.max_depth)
            ),
            p.start,
            p.end,
        );
        Ok(())
    }
}
