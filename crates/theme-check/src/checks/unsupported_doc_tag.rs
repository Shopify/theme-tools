use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use crate::liquid_doc::file_path_supports_liquid_doc;
use liquid_ast::{NodeKind, NodeRef};

pub static UNSUPPORTED_DOC_TAG: CheckDef = CheckDef {
    code: "UnsupportedDocTag",
    name: "Prevent unsupported doc tag usage",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    if file_path_supports_liquid_doc(cx.uri()) {
        return None;
    }
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
        if tag.name == "doc" {
            let fix = Fix::remove(tag.position.start, tag.position.end);
            let suggest = vec![Suggestion::new("Remove unsupported `doc` tag", fix)];
            cx.report_with(
                "The `doc` tag can only be used within a snippet or block.",
                tag.position.start,
                tag.position.end,
                None,
                Some(suggest),
            );
        }
        Ok(())
    }
}
