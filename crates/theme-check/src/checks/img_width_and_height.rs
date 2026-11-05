use super::utils::{is_attr, valued_html_attribute};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static IMG_WIDTH_AND_HEIGHT: CheckDef = CheckDef {
    code: "ImgWidthAndHeight",
    name: "Width and height attributes on image tags",
    aliases: &[],
    severity: Severity::Error,
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
        NodeKind::HtmlVoidElement.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::HtmlVoidElement(n) = node else {
            return Ok(());
        };
        if n.name != "img" {
            return Ok(());
        }
        let has = |name: &str| {
            n.attributes
                .iter()
                .filter_map(valued_html_attribute)
                .any(|a| is_attr(&a.name, name))
        };
        let message = match (has("width"), has("height")) {
            (true, true) => return Ok(()),
            (false, true) => "Missing width attribute on img tag",
            (true, false) => "Missing height attribute on img tag",
            (false, false) => "Missing width and height attributes on img tag",
        };
        cx.report(message, n.position.start, n.position.end);
        Ok(())
    }
}
