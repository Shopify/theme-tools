use super::schema_utils::{array, entries, get, has, node_at, truthy};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use crate::json::JsonNode;
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static SCHEMA_PRESETS_BLOCK_ORDER: CheckDef = CheckDef {
    code: "SchemaPresetsBlockOrder",
    name: "Gives recommendations and validations for block_order",
    aliases: &[],
    severity: Severity::Warning,
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
        if tag.name != "schema" || tag.body.kind != "json" {
            return Ok(());
        }
        let offset = tag.block_start_position.end;
        let Some(schema) = cx.get_schema() else {
            return Ok(());
        };
        let Some(valid_schema) = schema.valid_value().filter(|v| js::truthy(v)) else {
            return Ok(());
        };
        let Some(ast) = schema.ast() else {
            return Ok(());
        };

        let presets = get(valid_schema, "presets")?;
        if !truthy(presets) {
            return Ok(());
        }
        for (index, preset) in array(presets, "presets.forEach")?.iter().enumerate() {
            if has(preset, "blocks")? && truthy(get(preset, "blocks")?) {
                check_block_order(
                    cx,
                    preset,
                    offset,
                    ast,
                    &mut vec!["presets".into(), index.to_string()],
                )?;
            }
        }
        Ok(())
    }
}

/// `checkBlockOrder(node, ..., ast_path)`. `ast_path` is shared and mutated like the TS one:
/// a nested block's path leaks into the reports of the siblings after it.
fn check_block_order(
    cx: &mut Context,
    node: &Value,
    offset: usize,
    ast: &JsonNode,
    ast_path: &mut Vec<String>,
) -> CheckResult {
    if !has(node, "blocks")? {
        return Ok(());
    }
    let Some(blocks) = get(node, "blocks")?.filter(|b| js::truthy(b) && js::is_object_like(b))
    else {
        return Ok(());
    };
    let block_order = if has(node, "block_order")? {
        get(node, "block_order")?
    } else {
        None
    };

    // check 1: is block_order missing?
    if !truthy(block_order) && should_have_block_order(blocks)? {
        report_warning(
            cx,
            offset,
            ast,
            ast_path,
            "block_order is missing".into(),
            false,
        )?;
    }

    // check 2: are items in block_order present in blocks?
    if let Some(block_order) = block_order.filter(|b| !b.is_null()) {
        for (index, block_id) in array(Some(block_order), "blockOrder.forEach")?
            .iter()
            .enumerate()
        {
            // ponytail: `blocks[block_id]` also finds Object.prototype members in JS.
            if !blocks.is_array() && !truthy(get(blocks, &js::to_string(block_id))?) {
                let path = [&ast_path[..], &["block_order".into(), index.to_string()]].concat();
                let message = format!(
                    "block '{}' is missing from 'blocks'",
                    js::to_string(block_id)
                );
                report_warning(cx, offset, ast, &path, message, true)?;
            }
        }
    }

    // check 3: are items in blocks correctly in block_order?
    let order = block_order.and_then(Value::as_array);
    let in_order = |id: &str| order.is_some_and(|o| o.iter().any(|v| v.as_str() == Some(id)));
    for (block_id, block) in entries(blocks) {
        if truthy(get(&block, "static")?) {
            if order.is_some() && in_order(&block_id) {
                let path = [&ast_path[..], &["block_order".into()]].concat();
                let message = format!("static block '{block_id}' cannot be in the block_order");
                report_warning(cx, offset, ast, &path, message, true)?;
            }
        } else if order.is_some() && !in_order(&block_id) {
            let path = [&ast_path[..], &["block_order".into()]].concat();
            let message = format!("block '{block_id}' is missing from the block_order");
            report_warning(cx, offset, ast, &path, message, true)?;
        }

        // nested blocks
        if truthy(get(&block, "blocks")?) {
            ast_path.extend(["blocks".to_string(), block_id.into_owned()]);
            check_block_order(cx, &block, offset, ast, ast_path)?;
        }
    }
    Ok(())
}

/// `shouldHaveBlockOrder(node)`: blocks as a hash with a non-static block.
fn should_have_block_order(blocks: &Value) -> Result<bool, CheckError> {
    let Value::Object(map) = blocks else {
        return Ok(false);
    };
    for block in map.values() {
        if get(block, "static")? != Some(&Value::Bool(true)) {
            return Ok(true);
        }
    }
    Ok(false)
}

/// `reportWarning(..., fullHighlight)`: the node, or just its last character.
fn report_warning(
    cx: &mut Context,
    offset: usize,
    ast: &JsonNode,
    ast_path: &[String],
    message: String,
    full_highlight: bool,
) -> CheckResult {
    let node = node_at(ast, ast_path)
        .ok_or_else(|| CheckError::new("Cannot read properties of undefined (reading 'loc')"))?;
    let loc = node.loc();
    let start = if full_highlight {
        offset + loc.start
    } else {
        offset + loc.end - 1
    };
    cx.report(message, start, offset + loc.end);
    Ok(())
}
