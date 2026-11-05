use super::utils::{is_attr, valued_html_attribute};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Attr, Node, NodeKind, NodeRef};

pub static HARDCODED_ROUTES: CheckDef = CheckDef {
    code: "HardcodedRoutes",
    name: "Hardcoded Routes",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

/// `Object.keys(ROUTES).reverse()`, with each route's `routes` property.
const ROUTES: &[(&str, &str)] = &[
    ("/search/suggest", "predictive_search_url"),
    ("/search", "search_url"),
    ("/recommendations/products", "product_recommendations_url"),
    ("/customer_authentication/login", "storefront_login_url"),
    ("/collections/all", "all_products_collection_url"),
    ("/collections", "collections_url"),
    ("/cart/update", "cart_update_url"),
    ("/cart/clear", "cart_clear_url"),
    ("/cart/change", "cart_change_url"),
    ("/cart/add", "cart_add_url"),
    ("/cart", "cart_url"),
    ("/account/register", "account_register_url"),
    ("/account/recover", "account_recover_url"),
    ("/account/logout", "account_logout_url"),
    ("/account/login", "account_login_url"),
    ("/account/addresses", "account_addresses_url"),
    ("/account", "account_url"),
    ("/", "root_url"),
];

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

fn hardcoded_route(attr: &Attr) -> Option<&'static (&'static str, &'static str)> {
    let Some(Node::TextNode(t)) = attr.value.first() else {
        return None;
    };
    ROUTES.iter().find(|(route, _)| {
        if *route == "/" {
            t.value == "/" && attr.value.len() == 1
        } else {
            t.value.starts_with(route)
        }
    })
}

fn report(cx: &mut Context, (route, url): &(&str, &str), start: usize) {
    cx.report(
        format!("Use routes object {{{{ routes.{url} }}}} instead of hardcoding {route}"),
        start,
        start + route.len(),
    );
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::HtmlElement.bit() | NodeKind::LiquidFilter.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::HtmlElement(n) => {
                let found = n
                    .attributes
                    .iter()
                    .filter_map(valued_html_attribute)
                    .filter(|a| is_attr(&a.name, "action") || is_attr(&a.name, "href"))
                    .find_map(|a| hardcoded_route(a).map(|r| (a, r)));
                if let Some((attr, route)) = found {
                    report(cx, route, attr.attribute_position.start);
                }
            }
            NodeRef::LiquidFilter(f) if f.name == "link_to" => {
                // `node.args[0].type` throws when link_to has no arguments.
                let Some(arg) = f.args.first() else {
                    return Err(CheckError::new(
                        "Cannot read properties of undefined (reading 'type')",
                    ));
                };
                let value = match arg {
                    Node::String(s) => s.value.as_ref(),
                    _ => "",
                };
                let route = ROUTES.iter().find(|(route, _)| {
                    if *route == "/" {
                        value == "/"
                    } else {
                        value.starts_with(route)
                    }
                });
                if let Some(route) = route {
                    // + 1 skips the opening quote.
                    report(cx, route, arg.position().start + 1);
                }
            }
            _ => {}
        }
        Ok(())
    }
}
