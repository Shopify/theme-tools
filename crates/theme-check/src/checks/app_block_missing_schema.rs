use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{NodeKind, NodeRef};

pub static APP_BLOCK_MISSING_SCHEMA: CheckDef = CheckDef {
    code: "AppBlockMissingSchema",
    name: "Missing schema definitions in theme app extensions app blocks should be avoided",
    aliases: &[],
    severity: Severity::Error,
    // docs.recommended is true, but it only targets ThemeAppExtension, so `recommended` skips it.
    recommended: false,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

#[derive(Default)]
struct Check {
    found_schema: bool,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    // Theme app extension blocks are the only files that can define a schema.
    if !cx.to_relative_path(cx.uri()).starts_with("blocks/") {
        return None;
    }
    Some(Box::<Check>::default())
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], _: &mut Context<'a>) -> CheckResult {
        if matches!(node, NodeRef::LiquidRawTag(t) if t.name == "schema") {
            self.found_schema = true;
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        if !self.found_schema {
            cx.report("The schema does not exist", 0, 0);
        }
        Ok(())
    }
}
