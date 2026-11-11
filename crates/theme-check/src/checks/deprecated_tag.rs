use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use liquid_ast::Span;
use liquid_ast::{NodeKind, NodeRef};

pub static DEPRECATED_TAG: CheckDef = CheckDef {
    code: "DeprecatedTag",
    name: "Deprecated Tag",
    aliases: &["DeprecatedTags"],
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
    fn kinds(&self) -> &'static [NodeKind] {
        &[NodeKind::LiquidTag]
    }

    fn enter(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        if tag.name == "include" {
            let start = tag.span.start;
            // `indexOf` is never -1 here: the tag's source starts with its name.
            let at = start + cx.source()[start..].find("include").unwrap_or(0);
            let end = at + "include".len();
            let suggest = vec![Suggestion::new(
                "Replace 'include' with 'render'",
                Fix::replace(at, end, "render"),
            )];
            cx.report_with(
                "Use the 'render' tag instead of 'include'",
                Span::new(at, end),
                None,
                Some(suggest),
            );
        }
        Ok(())
    }
}
