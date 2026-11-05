use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::js_number_to_string;
use liquid_ast::{NodeKind, NodeRef, Position};

pub static LIQUID_COMPLEXITY: CheckDef = CheckDef {
    code: "LiquidComplexity",
    name: "LiquidComplexity",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[("maxComplexity", "120")],
    create: Create::Liquid(create),
};

const COUNTED_TAGS: &[&str] = &["if", "unless", "case", "for", "tablerow", "paginate"];
const COUNTED_BRANCHES: &[&str] = &["elsif", "when"];
const TAGS_WITH_CONDITIONS: &[&str] = &["if", "unless"];
const BRANCHES_WITH_CONDITIONS: &[&str] = &["elsif"];

struct Check {
    max_complexity: f64,
    complexity: u32,
    first_over_threshold: Option<Position>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let max_complexity = cx.setting_f64("maxComplexity").unwrap_or(120.0);
    Some(Box::new(Check {
        max_complexity,
        complexity: 1,
        first_over_threshold: None,
    }))
}

impl Check {
    /// `rangeFor(node)`: the tag/branch's `blockStartPosition`, the expression's `position`.
    fn increment(&mut self, range: Position) {
        self.complexity += 1;
        if self.first_over_threshold.is_none() && self.complexity as f64 > self.max_complexity {
            self.first_over_threshold = Some(range);
        }
    }
}

/// `isLogicalExpressionInControlFlowCondition(ancestors)`
fn in_control_flow_condition(ancestors: &[NodeRef]) -> bool {
    ancestors.iter().rev().find_map(|a| match a {
        NodeRef::LiquidTag(t) => Some(TAGS_WITH_CONDITIONS.contains(&t.name.as_ref())),
        NodeRef::LiquidBranch(b) => {
            Some(BRANCHES_WITH_CONDITIONS.contains(&b.name.as_deref().unwrap_or("")))
        }
        NodeRef::LiquidVariableOutput(_) => Some(false),
        _ => None,
    }) == Some(true)
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit() | NodeKind::LiquidBranch.bit() | NodeKind::LogicalExpression.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        _: &mut Context<'a>,
    ) -> CheckResult {
        match node {
            NodeRef::LiquidTag(t) if COUNTED_TAGS.contains(&t.name.as_ref()) => {
                self.increment(t.block_start_position)
            }
            NodeRef::LiquidBranch(b)
                if COUNTED_BRANCHES.contains(&b.name.as_deref().unwrap_or("")) =>
            {
                self.increment(b.block_start_position)
            }
            NodeRef::LogicalExpression(e) if in_control_flow_condition(ancestors) => {
                self.increment(e.position)
            }
            _ => {}
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        if self.complexity as f64 <= self.max_complexity {
            return Ok(());
        }
        let range = self
            .first_over_threshold
            .unwrap_or(Position::new(0, cx.source().len()));
        let line = cx.source()[..range.start].matches('\n').count() + 1;
        cx.report(
            format!(
                "Liquid complexity is {}, which exceeds the maximum of {}. The decision at line {line} pushed it over the limit. Consider simplifying conditional logic, or moving self-contained decision logic into snippets with the render tag.",
                self.complexity,
                js_number_to_string(self.max_complexity),
            ),
            range.start,
            range.end,
        );
        Ok(())
    }
}
