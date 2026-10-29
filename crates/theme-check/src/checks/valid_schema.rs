use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json_validator::JsonValidator;
use liquid_ast::{NodeKind, NodeRef};

pub static VALID_SCHEMA: CheckDef = CheckDef {
    code: "ValidSchema",
    name: "Prevent invalid JSON in {% schema %} tags",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check<'a> {
    validator: &'a JsonValidator,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check {
        validator: cx.deps.json_validator.as_ref()?,
    }))
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidRawTag(tag) = node else {
            return Ok(());
        };
        if tag.name != "schema" || tag.body.kind != "json" {
            return Ok(());
        }
        let offset = tag.block_start_position.end;
        let json = &cx.file.source[offset..tag.block_end_position.start];
        for p in self
            .validator
            .validate(&cx.file.uri, json)
            .map_err(CheckError)?
        {
            cx.report(p.message, offset + p.start, offset + p.end);
        }
        Ok(())
    }
}
