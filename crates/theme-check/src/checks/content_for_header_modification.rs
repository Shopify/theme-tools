use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Markup, Node, NodeKind, NodeRef, Position};

pub static CONTENT_FOR_HEADER_MODIFICATION: CheckDef = CheckDef {
    code: "ContentForHeaderModification",
    name: "Do not depend on the content of content_for_header",
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

fn check_content_for_header(cx: &mut Context, expression: &Node, p: Position) {
    if matches!(expression, Node::VariableLookup(v) if v.name.as_deref() == Some("content_for_header"))
    {
        cx.report(
            "Do not rely on the content of `content_for_header`",
            p.start,
            p.end,
        );
    }
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit() | NodeKind::LiquidVariableOutput.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::LiquidTag(tag) => match (tag.name.as_ref(), tag.markup.node()) {
                ("assign", Some(Node::AssignMarkup(m))) => {
                    check_content_for_header(cx, &m.value.expression, tag.position)
                }
                ("echo", Some(Node::LiquidVariable(v))) => {
                    check_content_for_header(cx, &v.expression, tag.position)
                }
                ("capture", _) if !tag.markup.is_str() => {
                    for child in tag.children.iter().flatten() {
                        if let Node::LiquidVariableOutput(o) = child {
                            if let Some(Node::LiquidVariable(v)) = o.markup.node() {
                                check_content_for_header(cx, &v.expression, o.position);
                            }
                        }
                    }
                }
                _ => {}
            },
            NodeRef::LiquidVariableOutput(o) => {
                if let Markup::Node(m) = &o.markup {
                    if let Node::LiquidVariable(v) = m.as_ref() {
                        if !v.filters.is_empty() {
                            check_content_for_header(cx, &v.expression, o.position);
                        }
                    }
                }
            }
            _ => {}
        }
        Ok(())
    }
}
