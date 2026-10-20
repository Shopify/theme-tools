//! AssetSizeCSS and AssetSizeJavaScript: the same check on stylesheets and scripts.

use super::file_utils::{
    has_local_asset_size_exceeded_threshold, has_remote_asset_size_exceeded_threshold,
};
use super::remote_asset::liquid_variable;
use super::utils::{is_attr, value_includes, valued_html_attribute};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use liquid_ast::{Attr, Node, NodeKind, NodeRef, Position};
use serde_json::Value;

pub static ASSET_SIZE_CSS: CheckDef = CheckDef {
    code: "AssetSizeCSS",
    name: "Prevent Large CSS bundles",
    aliases: &["AssetSizeCSSStylesheetTag"],
    severity: Severity::Error,
    recommended: false,
    deprecated: false,
    schema: &[("thresholdInBytes", "100000")],
    create: Create::Liquid(create_css),
};

pub static ASSET_SIZE_JAVASCRIPT: CheckDef = CheckDef {
    code: "AssetSizeJavaScript",
    name: "Prevent Large JavaScript bundles",
    aliases: &[],
    schema: &[("thresholdInBytes", "10000")],
    create: Create::Liquid(create_js),
    ..ASSET_SIZE_CSS
};

#[derive(Clone, Copy, PartialEq)]
enum Asset {
    Css,
    JavaScript,
}

struct Check {
    asset: Asset,
    threshold: Value,
}

fn create_css<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    create(cx, Asset::Css)
}

fn create_js<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    create(cx, Asset::JavaScript)
}

fn create<'a>(cx: &mut Context<'a>, asset: Asset) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let threshold = cx
        .settings
        .get("thresholdInBytes")
        .cloned()
        .unwrap_or(Value::Null);
    Some(Box::new(Check { asset, threshold }))
}

/// `/(https?:)?\/\//.test(url)`: unanchored, so any `//`.
fn is_url(value: &str) -> bool {
    value.contains("//")
}

impl Check {
    fn message(&self) -> String {
        let t = js::to_string(&self.threshold);
        match self.asset {
            Asset::Css => format!("The CSS file size exceeds the threshold of {t} bytes"),
            Asset::JavaScript => format!(
                "JavaScript on every page load exceeds compressed size threshold ({t} Bytes), consider using the import on interaction pattern."
            ),
        }
    }

    fn tag_filter(&self) -> &'static str {
        match self.asset {
            Asset::Css => "stylesheet_tag",
            Asset::JavaScript => "script_tag",
        }
    }

    fn check_remote_asset_size(&self, url: &str, p: Position, cx: &mut Context) -> CheckResult {
        if has_remote_asset_size_exceeded_threshold(cx, url, &self.threshold)? {
            cx.report(self.message(), p.start, p.end);
        }
        Ok(())
    }

    fn check_theme_asset_size(&self, src: &str, p: Position, cx: &mut Context) {
        if has_local_asset_size_exceeded_threshold(cx, &format!("assets/{src}"), &self.threshold) {
            cx.report(self.message(), p.start, p.end);
        }
    }

    /// `href="..."` / `src="..."` with a single value: a URL, or `{{ 'name' | asset_url }}`.
    fn check_url_attribute(&self, attr: &Attr, cx: &mut Context) -> CheckResult {
        let [value] = attr.value.as_slice() else {
            return Ok(());
        };
        let p = attr.attribute_position;
        if let Node::TextNode(t) = value {
            if is_url(&t.value) {
                self.check_remote_asset_size(&t.value, p, cx)?;
            }
        }
        if let Some(v) = liquid_variable(value) {
            if let (Node::String(s), [filter]) = (v.expression.as_ref(), v.filters.as_slice()) {
                if filter.name == "asset_url" {
                    self.check_theme_asset_size(&s.value, p, cx);
                }
            }
        }
        Ok(())
    }
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        let html = match self.asset {
            Asset::Css => NodeKind::HtmlVoidElement,
            Asset::JavaScript => NodeKind::HtmlRawNode,
        };
        html.bit() | NodeKind::LiquidFilter.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        let valued = |attrs: &'a [Node<'a>], name| {
            attrs
                .iter()
                .filter_map(valued_html_attribute)
                .find(|a| is_attr(&a.name, name))
        };
        match node {
            // <link rel="stylesheet" href="...">
            NodeRef::HtmlVoidElement(n) if n.name == "link" => {
                let rel_is_stylesheet = n
                    .attributes
                    .iter()
                    .filter_map(valued_html_attribute)
                    .any(|a| is_attr(&a.name, "rel") && value_includes(a, "stylesheet"));
                if let (true, Some(href)) = (rel_is_stylesheet, valued(&n.attributes, "href")) {
                    self.check_url_attribute(href, cx)?;
                }
            }
            // <script src="...">
            NodeRef::HtmlRawNode(n) if n.name == "script" => {
                if let Some(src) = valued(&n.attributes, "src") {
                    self.check_url_attribute(src, cx)?;
                }
            }
            // {{ 'url' | stylesheet_tag }} / {{ 'name' | asset_url | stylesheet_tag }}
            NodeRef::LiquidFilter(f) if f.name == self.tag_filter() => {
                let Some(NodeRef::LiquidVariable(parent)) = ancestors.last() else {
                    return Ok(());
                };
                let Node::String(s) = parent.expression.as_ref() else {
                    return Ok(());
                };
                // `expression.value[0].length`
                if s.value.is_empty() {
                    return Err(CheckError::new(
                        "Cannot read properties of undefined (reading 'length')",
                    ));
                }
                let filters = &parent.filters;
                if filters.len() == 1 && is_url(&s.value) {
                    self.check_remote_asset_size(&s.value, s.position, cx)?;
                }
                if filters.len() == 2
                    && filters[0].name == "asset_url"
                    && filters[1].name == self.tag_filter()
                {
                    self.check_theme_asset_size(&s.value, parent.position, cx);
                }
            }
            _ => {}
        }
        Ok(())
    }
}
