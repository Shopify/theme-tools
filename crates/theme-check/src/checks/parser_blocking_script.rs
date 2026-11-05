use super::utils::{has_attribute_value_of, html_attribute, is_attr, valued_html_attribute};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use liquid_ast::{NodeKind, NodeRef};

pub static PARSER_BLOCKING_SCRIPT: CheckDef = CheckDef {
    code: "ParserBlockingScript",
    name: "Avoid parser blocking scripts",
    aliases: &["ParserBlockingScriptTag"],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check;

/// `suggestionMessage(attr)`
fn suggestion_message(attr: &str) -> String {
    format!("Use an HTML script tag with the {attr} attribute instead")
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidFilter.bit() | NodeKind::HtmlRawNode.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        match node {
            // {{ 'asset' | asset_url | script_tag }}
            NodeRef::LiquidFilter(f) if f.name == "script_tag" => {
                let p = f.position;
                // `indexOf` is never -1 here: the filter's source contains its name.
                let start = p.start + cx.source()[p.start..p.end].find("script_tag").unwrap_or(0);
                let parent = ancestors.last();
                let grandparent = ancestors.len().checked_sub(2).map(|i| ancestors[i]);
                let suggest = match (grandparent, parent) {
                    (
                        Some(NodeRef::LiquidVariableOutput(output)),
                        Some(NodeRef::LiquidVariable(var)),
                    ) if var.filters.last().is_some_and(|l| std::ptr::eq(l, f)) => {
                        let end = var
                            .filters
                            .len()
                            .checked_sub(2)
                            .map_or(p.start, |i| var.filters[i].position.end);
                        let url = format!(
                            "{{{{ {} }}}}",
                            &cx.source()[var.expression.position().start..end]
                        );
                        let fix = |attr: &str| {
                            let script = format!("<script src=\"{url}\" {attr}></script>");
                            Suggestion::new(
                                suggestion_message(attr),
                                Fix::replace(output.position.start, output.position.end, script),
                            )
                        };
                        Some(vec![fix("defer"), fix("async")])
                    }
                    _ => None,
                };
                cx.report_with(
                    "The script_tag filter is parser-blocking. Use a <script> tag with async or defer for better performance",
                    start,
                    p.end,
                    None,
                    suggest,
                );
            }
            // <script src="...">
            NodeRef::HtmlRawNode(n) if n.name == "script" => {
                let attrs = &n.attributes;
                let has_src = attrs
                    .iter()
                    .filter_map(valued_html_attribute)
                    .any(|a| is_attr(&a.name, "src"));
                if !has_src {
                    return Ok(());
                }
                let has_defer_or_async = attrs
                    .iter()
                    .filter_map(html_attribute)
                    .any(|a| is_attr(a.name(), "async") || is_attr(a.name(), "defer"));
                let is_type_module = attrs.iter().filter_map(valued_html_attribute).any(|a| {
                    is_attr(&a.name, "type")
                        && (has_attribute_value_of(a, "module")
                            || has_attribute_value_of(a, "importmap"))
                });
                if has_defer_or_async || is_type_module {
                    return Ok(());
                }
                let at = n.block_start_position.end - 1;
                let fix = |attr: &str| {
                    Suggestion::new(
                        suggestion_message(attr),
                        Fix::insert(at, format!(" {attr}")),
                    )
                };
                cx.report_with(
                    "Avoid parser blocking scripts by adding `defer` or `async` on this tag",
                    n.position.start,
                    n.position.end,
                    None,
                    Some(vec![fix("defer"), fix("async")]),
                );
            }
            _ => {}
        }
        Ok(())
    }
}
