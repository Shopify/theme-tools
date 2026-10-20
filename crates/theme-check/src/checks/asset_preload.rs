use super::utils::{has_attribute_value_of, is_attr, valued_html_attribute};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Attr, Node, NodeKind, NodeRef};

pub static ASSET_PRELOAD: CheckDef = CheckDef {
    code: "AssetPreload",
    name: "Prevent Manual Preloading of Assets",
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

fn is_preload(attr: &Attr) -> bool {
    is_attr(&attr.name, "rel")
        && attr
            .value
            .iter()
            .any(|n| matches!(n, Node::TextNode(t) if t.value == "preload"))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::HtmlVoidElement.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::HtmlVoidElement(n) = node else {
            return Ok(());
        };
        let valued = || n.attributes.iter().filter_map(valued_html_attribute);
        if n.name != "link" || !valued().any(is_preload) {
            return Ok(());
        }
        let high_priority_image = valued()
            .any(|a| is_attr(&a.name, "as") && has_attribute_value_of(a, "image"))
            && valued()
                .any(|a| is_attr(&a.name, "fetchpriority") && has_attribute_value_of(a, "high"));
        if high_priority_image {
            return Ok(());
        }
        let asset_type = valued().find(|a| is_attr(&a.name, "as")).and_then(|a| {
            a.value.iter().find_map(|v| match v {
                Node::TextNode(t) => Some(t.value.as_ref()),
                _ => None,
            })
        });
        let message = match asset_type {
            Some("style") => "For better performance, prefer using the preload argument of the stylesheet_tag filter",
            Some("image") => "For better performance, prefer using the preload argument of the image_tag filter",
            _ => "For better performance, prefer using the preload_tag filter",
        };
        cx.report(message, n.position.start, n.position.end);
        Ok(())
    }
}
