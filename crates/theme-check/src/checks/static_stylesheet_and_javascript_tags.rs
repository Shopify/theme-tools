use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Node, NodeKind, NodeRef};

pub static STATIC_STYLESHEET_AND_JAVASCRIPT_TAGS: CheckDef = CheckDef {
    code: "StaticStylesheetAndJavascriptTags",
    name: "Reports non static stylesheet and javascript tags",
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
        NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidRawTag(tag) = node else {
            return Ok(());
        };
        let tag_type = match tag.name.as_ref() {
            "stylesheet" => "CSS",
            "javascript" => "JavaScript",
            _ => return Ok(()),
        };
        for child in &tag.body.nodes {
            let liquid_type = match child {
                Node::LiquidVariableOutput(_) => "variable",
                Node::LiquidTag(_) | Node::LiquidRawTag(_) => "tag",
                _ => continue,
            };
            let p = child.position();
            cx.report(
                format!(
                    "Liquid {liquid_type} found in {tag_type} block. {{% {} %}} tags should only contain static {tag_type} code.",
                    tag.name
                ),
                p.start,
                p.end,
            );
        }
        Ok(())
    }
}
