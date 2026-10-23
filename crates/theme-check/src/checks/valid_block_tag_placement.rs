use super::block_tag_syntax::block_tag_syntax_error;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};
use regex::Regex;
use std::sync::LazyLock;

pub static VALID_BLOCK_TAG_PLACEMENT: CheckDef = CheckDef {
    code: "ValidBlockTagPlacement",
    name: "Valid Block Tag Placement",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

static TEMPLATE_FILE_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^templates/(?:[^/]+/)*[^/]+\.liquid$").unwrap());
static LAYOUT_FILE_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^layout/[^/]+\.liquid$").unwrap());

struct Check;

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let relative_path = cx.to_relative_path(cx.uri());
    if TEMPLATE_FILE_PATTERN.is_match(&relative_path)
        || LAYOUT_FILE_PATTERN.is_match(&relative_path)
    {
        return None;
    }
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        if tag.name == "block" && block_tag_syntax_error(tag, cx.source()).is_none() {
            let p = tag.position;
            cx.report(
                "The 'block' tag can only be used in templates/**/*.liquid and layout/*.liquid.",
                p.start,
                p.end,
            );
        }
        Ok(())
    }
}
