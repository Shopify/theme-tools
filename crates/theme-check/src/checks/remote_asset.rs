use super::utils::{get_html_node_name, is_attr, valued_html_attribute};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Attr, LiquidVariable, Node, NodeKind, NodeRef};
use std::borrow::Cow;

pub static REMOTE_ASSET: CheckDef = CheckDef {
    code: "RemoteAsset",
    name: "Remote Asset",
    aliases: &["AssetUrlFilters"],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[("allowedDomains", "null")],
    create: Create::Liquid(create),
};

const RESOURCE_TAGS: &[&str] = &["img", "link", "source", "script"];
const SHOPIFY_CDN_DOMAINS: &[&str] = &["fonts.shopifycdn.com", "cdn.shopify.com"];
const TAGNAMES: &[&str] = &["stylesheet_tag", "script_tag", "image_tag", "img_tag"];
const DEPRECATED: &[&str] = &[
    "product_img_url",
    "article_img_url",
    "collection_img_url",
    "img_url",
];
const NON_DEPRECATED: &[&str] = &[
    "asset_url",
    "image_url",
    "asset_img_url",
    "file_img_url",
    "file_url",
    "global_asset_url",
    "shopify_asset_url",
    "external_video_url",
    "font_url",
];
const LIQUID_OBJECT: &str = "canonical_url";

const CDN_MESSAGE: &str = "Asset should be served by the Shopify CDN for better performance.";
const FILTER_MESSAGE: &str =
    "Use one of the asset_url filters to serve assets for better performance.";

struct Check {
    allowed_domains: Vec<String>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    // normaliseAllowedDomains: `new URL(domain).hostname` minus a leading `www.`, invalid ones dropped.
    let allowed_domains = cx
        .setting_strs("allowedDomains")
        .into_iter()
        .filter_map(url_hostname)
        .map(|h| h.strip_prefix("www.").map(str::to_string).unwrap_or(h))
        .collect();
    Some(Box::new(Check { allowed_domains }))
}

/// `cleanUrlText(url)`: strips curly quotes.
fn clean_url_text(url: &str) -> Cow<'_, str> {
    const QUOTES: [char; 4] = ['“', '”', '‘', '’'];
    if url.contains(QUOTES) {
        Cow::Owned(url.replace(QUOTES, ""))
    } else {
        Cow::Borrowed(url)
    }
}

fn is_data_uri(url: &str) -> bool {
    url.as_bytes()
        .get(..5)
        .is_some_and(|b| b.eq_ignore_ascii_case(b"data:"))
}

/// `/^(https?:)?\/\//`
fn is_absolute_or_protocol_relative(url: &str) -> bool {
    url.strip_prefix("https:")
        .or_else(|| url.strip_prefix("http:"))
        .unwrap_or(url)
        .starts_with("//")
}

pub(super) fn liquid_variable<'a>(node: &'a Node<'a>) -> Option<&'a LiquidVariable<'a>> {
    let Node::LiquidVariableOutput(o) = node else {
        return None;
    };
    match o.markup.node() {
        Some(Node::LiquidVariable(v)) => Some(v),
        _ => None,
    }
}

impl Check {
    /// `isUrlHostedbyShopify(url, allowedDomains)`
    fn is_url_hosted_by_shopify(&self, url: &str) -> bool {
        if url.starts_with("/cdn/") {
            return true;
        }
        url_hostname(url).is_some_and(|h| {
            SHOPIFY_CDN_DOMAINS.contains(&h.as_str()) || self.allowed_domains.contains(&h)
        })
    }

    /// `valueIsDefinitelyNotShopifyHosted(attr, allowedDomains)`
    fn value_is_definitely_not_shopify_hosted(&self, attr: &Attr) -> bool {
        attr.value.iter().any(|node| {
            if let Node::TextNode(t) = node {
                let url = clean_url_text(&t.value);
                if is_absolute_or_protocol_relative(&url) && !self.is_url_hosted_by_shopify(&url) {
                    return true;
                }
            }
            if let Some(Node::String(s)) = liquid_variable(node).map(|v| v.expression.as_ref()) {
                if (s.value.starts_with("http://") || s.value.starts_with("https://"))
                    && !self.is_url_hosted_by_shopify(&s.value)
                {
                    return true;
                }
            }
            false
        })
    }

    fn check_html_node(&self, node: NodeRef, attributes: &[Node], cx: &mut Context) {
        if !get_html_node_name(node).is_some_and(|n| RESOURCE_TAGS.contains(&n)) {
            return;
        }
        let Some(url_attr) = attributes
            .iter()
            .filter_map(valued_html_attribute)
            .find(|a| is_attr(&a.name, "src") || is_attr(&a.name, "href"))
        else {
            return;
        };
        let first_text = url_attr.value.iter().find_map(|n| match n {
            Node::TextNode(t) => Some(clean_url_text(&t.value)),
            _ => None,
        });
        if first_text.is_some_and(|t| t.starts_with('#') || is_data_uri(&t)) {
            return;
        }
        // startsWithVariableLookup(urlAttribute)
        if url_attr
            .value
            .first()
            .and_then(liquid_variable)
            .is_some_and(|v| matches!(v.expression.as_ref(), Node::VariableLookup(_)))
        {
            return;
        }
        let is_shopify_url = url_attr
            .value
            .iter()
            .any(|n| matches!(n, Node::TextNode(t) if self.is_url_hosted_by_shopify(&clean_url_text(&t.value))));
        if is_shopify_url {
            return;
        }
        let p = url_attr.position;
        if self.value_is_definitely_not_shopify_hosted(url_attr) {
            cx.report(CDN_MESSAGE, p.start, p.end);
            return;
        }
        // valueIsShopifyHosted(urlAttribute)
        let is_shopify_hosted = url_attr.value.iter().filter_map(liquid_variable).any(|v| {
            v.filters.iter().any(|f| DEPRECATED.contains(&f.name.as_ref()) || NON_DEPRECATED.contains(&f.name.as_ref()))
                || matches!(v.expression.as_ref(), Node::VariableLookup(l) if l.name.as_deref() == Some(LIQUID_OBJECT))
        });
        if !is_shopify_hosted {
            cx.report(FILTER_MESSAGE, p.start, p.end);
        }
    }
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::HtmlVoidElement.bit()
            | NodeKind::HtmlSelfClosingElement.bit()
            | NodeKind::HtmlRawNode.bit()
            | NodeKind::LiquidFilter.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        match node {
            NodeRef::HtmlVoidElement(n) => self.check_html_node(node, &n.attributes, cx),
            NodeRef::HtmlSelfClosingElement(n) => self.check_html_node(node, &n.attributes, cx),
            NodeRef::HtmlRawNode(n) => self.check_html_node(node, &n.attributes, cx),
            NodeRef::LiquidFilter(f) if TAGNAMES.contains(&f.name.as_ref()) => {
                let Some(NodeRef::LiquidVariable(parent)) = ancestors.last() else {
                    return Ok(());
                };
                if parent.filters.iter().any(|f| {
                    DEPRECATED.contains(&f.name.as_ref())
                        || NON_DEPRECATED.contains(&f.name.as_ref())
                }) {
                    return Ok(());
                }
                let url_node = parent.expression.as_ref();
                if let Node::String(s) = url_node {
                    if is_data_uri(&s.value) {
                        return Ok(());
                    }
                    if !self.is_url_hosted_by_shopify(&s.value) {
                        cx.report(CDN_MESSAGE, s.position.start, s.position.end);
                    }
                }
                cx.report(FILTER_MESSAGE, url_node.position().start, f.position.end);
            }
            _ => {}
        }
        Ok(())
    }
}

/// `new URL(input).hostname`, `None` where it throws (WHATWG URL parsing, no base).
/// ponytail: hosts are ASCII-lowercased and percent-decoded, but not IDNA-mapped, and IPv4/IPv6
/// hosts aren't canonicalized: a non-ASCII or bracketed host gives `None`. Only equality with
/// the CDN domains and `allowedDomains` matters, so this only differs for IDN or IP entries.
pub(super) fn url_hostname(input: &str) -> Option<String> {
    let input = input.trim_matches(|c: char| c <= ' ');
    let cleaned: Cow<str> = if input.contains(['\t', '\n', '\r']) {
        Cow::Owned(input.replace(['\t', '\n', '\r'], ""))
    } else {
        Cow::Borrowed(input)
    };
    let (scheme, rest) = cleaned.split_once(':')?;
    let mut chars = scheme.chars();
    if !chars.next()?.is_ascii_alphabetic()
        || !chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
    {
        return None;
    }
    let scheme = scheme.to_ascii_lowercase();
    let special = matches!(
        scheme.as_str(),
        "http" | "https" | "ws" | "wss" | "ftp" | "file"
    );
    let is_slash = |c: char| c == '/' || (special && c == '\\');
    let end_of_authority = |c: char| is_slash(c) || c == '?' || c == '#';

    if scheme == "file" {
        // file slash state: `file://host/...` has a host; anything else has an empty one.
        let mut it = rest.chars();
        if !(it.next().is_some_and(is_slash) && it.next().is_some_and(is_slash)) {
            return Some(String::new());
        }
        let host = &rest[2..];
        let host = &host[..host.find(end_of_authority).unwrap_or(host.len())];
        let b = host.as_bytes();
        // A Windows drive letter is a path, not a host.
        if host.is_empty()
            || (b.len() == 2 && b[0].is_ascii_alphabetic() && matches!(b[1], b':' | b'|'))
        {
            return Some(String::new());
        }
        return special_host(host).map(|h| if h == "localhost" { String::new() } else { h });
    }

    let authority = if special {
        rest.trim_start_matches(is_slash)
    } else {
        match rest.strip_prefix("//") {
            Some(r) => r,
            None => return Some(String::new()),
        }
    };
    let authority = &authority[..authority.find(end_of_authority).unwrap_or(authority.len())];
    let host_port = match authority.rfind('@') {
        Some(at) if at + 1 == authority.len() => return None,
        Some(at) => &authority[at + 1..],
        None => authority,
    };
    let (host, port) = match host_port
        .rfind(':')
        .filter(|&i| !host_port[i..].contains(']'))
    {
        Some(i) => (&host_port[..i], &host_port[i + 1..]),
        None => (host_port, ""),
    };
    if !port.bytes().all(|b| b.is_ascii_digit())
        || (!port.is_empty() && port.trim_start_matches('0').len() > 5)
        || port.parse::<u32>().is_ok_and(|p| p > 65535)
    {
        return None;
    }
    if special {
        if host.is_empty() {
            return None;
        }
        special_host(host)
    } else {
        opaque_host(host)
    }
}

const FORBIDDEN_HOST: &[u8] = b" #/:<>?@[\\]^|";

/// Domain host parsing for special schemes: percent-decode, ASCII-lowercase, reject forbidden
/// domain code points.
fn special_host(host: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(host.len());
    let b = host.as_bytes();
    let mut i = 0;
    while i < b.len() {
        let hex = |c: u8| (c as char).to_digit(16);
        if b[i] == b'%' && i + 2 < b.len() {
            if let (Some(h), Some(l)) = (hex(b[i + 1]), hex(b[i + 2])) {
                bytes.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        bytes.push(b[i]);
        i += 1;
    }
    if bytes
        .iter()
        .any(|&c| c >= 0x80 || c <= 0x20 || c == 0x7f || c == b'%' || FORBIDDEN_HOST.contains(&c))
    {
        return None;
    }
    bytes.make_ascii_lowercase();
    String::from_utf8(bytes).ok()
}

/// Opaque host parsing for non-special schemes: no lowercasing; C0 controls, DEL and non-ASCII
/// are percent-encoded.
fn opaque_host(host: &str) -> Option<String> {
    if host.starts_with('[') || host.bytes().any(|c| c == 0 || FORBIDDEN_HOST.contains(&c)) {
        return None;
    }
    let mut out = String::with_capacity(host.len());
    for b in host.bytes() {
        if b < 0x20 || b > 0x7e {
            out.push_str(&format!("%{b:02X}"));
        } else {
            out.push(b as char);
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::url_hostname;

    #[test]
    fn hostnames() {
        let h = |s| url_hostname(s);
        assert_eq!(
            h("https://cdn.shopify.com/s/files"),
            Some("cdn.shopify.com".into())
        );
        assert_eq!(
            h(" HTTPS://User:pw@CDN.Shopify.com:443/x"),
            Some("cdn.shopify.com".into())
        );
        assert_eq!(
            h("https:\\\\cdn.shopify.com\\x"),
            Some("cdn.shopify.com".into())
        );
        assert_eq!(h("https:cdn.shopify.com"), Some("cdn.shopify.com".into()));
        assert_eq!(
            h("https://cdn.shop\nify.com"),
            Some("cdn.shopify.com".into())
        );
        assert_eq!(
            h("https://cdn%2Eshopify.com"),
            Some("cdn.shopify.com".into())
        );
        assert_eq!(h("git://Cdn.shopify.com/x"), Some("Cdn.shopify.com".into()));
        assert_eq!(h("mailto:a@b.c"), Some("".into()));
        assert_eq!(h("file:///etc"), Some("".into()));
        assert_eq!(h("//cdn.shopify.com/x"), None);
        assert_eq!(h("/cdn/x"), None);
        assert_eq!(h("https://cdn.shopify.com:99999/"), None);
        assert_eq!(h("https://cdn.shopify.com:8x/"), None);
        assert_eq!(h("https://"), None);
        assert_eq!(h("https://a@"), None);
        assert_eq!(h("https://a b.com"), None);
        assert_eq!(h("1http://x"), None);
    }
}
