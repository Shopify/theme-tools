use super::utils::{get_html_node_name, is_attr, value_includes, valued_html_attribute};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Node, NodeKind, NodeRef};
use regex::Regex;
use std::sync::LazyLock;

pub static CDN_PRECONNECT: CheckDef = CheckDef {
    code: "CdnPreconnect",
    name: "CDN Preconnect",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

/// `valueIncludes(attr, '.+cdn.shopify.com.+')`: the word is a regex, `(^|\s)<word>(\s|$)` with
/// JS `\s` and `.`.
static SHOPIFY_CDN: LazyLock<Regex> = LazyLock::new(|| {
    let s = r"[\t\n\x0B\x0C\r \u{a0}\u{1680}\u{2000}-\u{200a}\u{2028}\u{2029}\u{202f}\u{205f}\u{3000}\u{feff}]";
    let dot = r"[^\n\r\u{2028}\u{2029}]";
    Regex::new(&format!(
        "(?:^|{s}){dot}+cdn{dot}shopify{dot}com{dot}+(?:{s}|$)"
    ))
    .unwrap()
});

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
        if get_html_node_name(node) != Some("link") {
            return Ok(());
        }
        let valued = || attributes.iter().filter_map(valued_html_attribute);
        if !valued().any(|a| is_attr(&a.name, "rel") && value_includes(a, "preconnect")) {
            return Ok(());
        }
        let is_shopify_cdn = valued().any(|a| {
            is_attr(&a.name, "href")
                && a.value
                    .iter()
                    .any(|v| matches!(v, Node::TextNode(t) if SHOPIFY_CDN.is_match(&t.value)))
        });
        if !is_shopify_cdn {
            return Ok(());
        }
        let p = node.position();
        cx.report(
            "Preconnecting to cdn.shopify.com is unnecessary and can lead to worse performance",
            p.start,
            p.end,
        );
        Ok(())
    }
}
