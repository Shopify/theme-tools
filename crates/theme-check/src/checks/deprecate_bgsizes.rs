use super::utils::{is_attr, value_includes, valued_html_attribute};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static DEPRECATE_BGSIZES: CheckDef = CheckDef {
    code: "DeprecateBgsizes",
    name: "Deprecate Bgsizes",
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
    fn kinds(&self) -> &'static [NodeKind] {
        &[NodeKind::HtmlElement]
    }

    fn enter(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::HtmlElement(n) = node else {
            return Ok(());
        };
        let valued = || n.attributes.iter().filter_map(valued_html_attribute);
        if let Some(a) =
            valued().find(|a| is_attr(&a.name, "class") && value_includes(a, "lazyload"))
        {
            let p = a.value_span;
            cx.report(
                "Use the native loading=\"lazy\" attribute instead of lazysizes",
                p,
            );
        }
        if let Some(a) = valued().find(|a| is_attr(&a.name, "data-bgset")) {
            cx.report(
                "Use the CSS imageset attribute instead of data-bgset",
                a.span,
            );
        }
        Ok(())
    }
}
