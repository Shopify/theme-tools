use super::liquid_html_syntax_error::utils::add16;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::docset::ThemeDocset;
use liquid_ast::{NodeKind, NodeRef};

pub static UNKNOWN_FILTER: CheckDef = CheckDef {
    code: "UnknownFilter",
    name: "Prevent use of unknown filters",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check<'a> {
    docset: &'a ThemeDocset,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check {
        docset: cx.docset()?,
    }))
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidFilter.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidFilter(f) = node else {
            return Ok(());
        };
        if self.docset.filter(&f.name).is_none() {
            cx.report(
                format!("Unknown filter '{}' used.", f.name),
                add16(cx.source(), f.position.start, 1),
                f.position.end,
            );
        }
        Ok(())
    }
}
