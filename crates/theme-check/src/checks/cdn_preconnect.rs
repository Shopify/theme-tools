use super::utils::{get_html_node_name, is_attr, value_includes, valued_html_attribute};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use liquid_ast::{Attr, Node, NodeKind, NodeRef};
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

/// `/^(https?:)?\/\/cdn\.shopify\.com(:443)?/i`. JS `i` without `u` folds ASCII letters
/// only, so `(?i-u)` keeps the Kelvin sign and long s from matching `k` and `s`.
static SHOPIFY_CDN_ORIGIN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i-u)^(?:https?:)?//cdn\.shopify\.com(?::443)?").unwrap());

/// `isShopifyCdnUrl(attr)`: the href starts with the cdn.shopify.com origin in static text, and
/// the host ends there: at a path, query or fragment, or at the end of the whole value.
fn is_shopify_cdn_url(attr: &Attr) -> bool {
    let [Node::TextNode(first), rest @ ..] = attr.value.as_slice() else {
        return false;
    };
    let url = js::trim(&first.value);
    let Some(origin) = SHOPIFY_CDN_ORIGIN.find(url) else {
        return false;
    };
    match &url[origin.end()..] {
        "" => rest.is_empty(),
        after => after.starts_with(['/', '?', '#']),
    }
}

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn kinds(&self) -> &'static [NodeKind] {
        &[NodeKind::HtmlVoidElement, NodeKind::HtmlSelfClosingElement]
    }

    fn enter(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
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
        if !valued().any(|a| is_attr(&a.name, "href") && is_shopify_cdn_url(a)) {
            return Ok(());
        }
        let p = node.span();
        cx.report(
            "Preconnecting to cdn.shopify.com is unnecessary and can lead to worse performance",
            p,
        );
        Ok(())
    }
}
