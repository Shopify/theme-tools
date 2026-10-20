use super::utils::{
    get_html_node_name, html_attribute, is_attr, value_includes, valued_html_attribute,
};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static DEPRECATE_LAZYSIZES: CheckDef = CheckDef {
    code: "DeprecateLazysizes",
    name: "Deprecate Lazysizes",
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
        NodeKind::HtmlVoidElement.bit() | NodeKind::HtmlSelfClosingElement.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let attributes = match node {
            NodeRef::HtmlVoidElement(n) => &n.attributes,
            NodeRef::HtmlSelfClosingElement(n) => &n.attributes,
            _ => return Ok(()),
        };
        if get_html_node_name(node) != Some("img") {
            return Ok(());
        }
        let has = |name: &str| {
            attributes
                .iter()
                .filter_map(html_attribute)
                .any(|a| is_attr(a.name(), name))
        };
        if has("src") && has("loading") {
            return Ok(());
        }
        let valued = || attributes.iter().filter_map(valued_html_attribute);
        if !valued().any(|a| is_attr(&a.name, "class") && value_includes(a, "lazyload")) {
            return Ok(());
        }
        if !valued().any(|a| is_attr(&a.name, "data-srcset") || is_attr(&a.name, "data-sizes")) {
            return Ok(());
        }
        let p = node.position();
        cx.report(
            "Use the native loading=\"lazy\" attribute instead of lazysizes",
            p.start,
            p.end,
        );
        Ok(())
    }
}
