use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::truthy;
use liquid_ast::{Node, NodeKind, NodeRef, Position};
use serde_json::Value;

pub static EMPTY_BLOCK_CONTENT: CheckDef = CheckDef {
    code: "EmptyBlockContent",
    name: "Prevent empty block content",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

#[derive(Default)]
struct Check {
    /// The last `{% content_for "blocks" %}`.
    content_for_blocks_location: Option<Position>,
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

/// `blocks.length === 0` for a truthy `blocks`.
fn has_zero_length(blocks: &Value) -> bool {
    match blocks {
        Value::Array(a) => a.is_empty(),
        Value::Object(o) => o.get("length").and_then(Value::as_f64) == Some(0.0),
        _ => false,
    }
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], _: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        if tag.name == "content_for" {
            if let Some(Node::ContentForMarkup(m)) = tag.markup.node() {
                if m.content_for_type.value == "blocks" {
                    self.content_for_blocks_location = Some(tag.block_start_position);
                }
            }
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let Some(schema) = cx.get_schema() else {
            return Ok(());
        };
        let Some(valid_schema) = schema.valid_value().filter(|v| truthy(v)) else {
            return Ok(());
        };
        if schema.ast().is_none() {
            return Ok(());
        }
        let Some(p) = self.content_for_blocks_location else {
            return Ok(());
        };
        match valid_schema.get("blocks").filter(|b| truthy(b)) {
            None => cx.report(
                r#"The 'content_for "blocks"' tag is present, but the blocks array is not defined."#,
                p.start,
                p.end,
            ),
            Some(blocks) if has_zero_length(blocks) => {
                cx.report(r#"The 'content_for "blocks"' tag is present, but the blocks array is empty."#, p.start, p.end)
            }
            Some(_) => {}
        }
        Ok(())
    }
}
