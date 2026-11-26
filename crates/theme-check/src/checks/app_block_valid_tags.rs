use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::Span;
use liquid_ast::{NodeKind, NodeRef};

pub static APP_BLOCK_VALID_TAGS: CheckDef = CheckDef {
    code: "AppBlockValidTags",
    name: "App Block Valid Tags",
    aliases: &[],
    severity: Severity::Error,
    recommended: false,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

/// `ForbiddenTag`
const FORBIDDEN_TAGS: &[&str] = &[
    "javascript",
    "stylesheet",
    "include",
    "layout",
    "section",
    "sections",
];

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn kinds(&self) -> &'static [NodeKind] {
        &[NodeKind::LiquidRawTag, NodeKind::LiquidTag]
    }

    fn enter(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        // A forbidden tag with an end tag highlights the whole block.
        let (name, start, end) = match node {
            NodeRef::LiquidRawTag(t) => (&t.name, t.start_tag.start, t.end_tag.end),
            NodeRef::LiquidTag(t) => (&t.name, t.start_tag.start, t.end_tag.unwrap_or(t.span).end),
            _ => return Ok(()),
        };
        if FORBIDDEN_TAGS.contains(&name.as_ref()) {
            cx.report(
                format!("Theme app extension blocks cannot contain '{name}' tags"),
                Span::new(start, end),
            );
        }
        Ok(())
    }
}
