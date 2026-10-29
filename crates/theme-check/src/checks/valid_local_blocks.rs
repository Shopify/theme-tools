use super::schema_utils::{array, get, has, is_str, node_at, report_warning, truthy, with};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use crate::schema::{is_block, is_section};
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static VALID_LOCAL_BLOCKS: CheckDef = CheckDef {
    code: "ValidLocalBlocks",
    name: "Prevent mixing static and local blocks in non-theme sections",
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

        let b = get_blocks(valid_schema)?;
        let report = |cx: &mut Context, locations: &[Vec<String>], message: &str| -> CheckResult {
            for path in locations {
                report_warning(cx, message.to_string(), offset, node_at(ast, path))?;
            }
            Ok(())
        };

        if is_section(cx.uri()) {
            if !b.static_blocks.is_empty() && !b.local_blocks.is_empty() {
                let message =
                    "Sections cannot use static theme blocks together with locally scoped blocks.";
                report(cx, &b.static_blocks, message)?;
            }
            let has_root_level_theme_blocks = b.theme_blocks.iter().any(|p| p[0] == "blocks");
            if has_root_level_theme_blocks
                && !b.local_blocks.is_empty()
                && !b.theme_blocks.is_empty()
            {
                report(
                    cx,
                    &b.local_blocks,
                    "Sections cannot use theme blocks together with locally scoped blocks.",
                )?;
            }
        }
        if is_block(cx.uri()) && !b.local_blocks.is_empty() {
            report(
                cx,
                &b.local_blocks,
                "Local scoped blocks are not supported in theme blocks.",
            )?;
        }
        Ok(())
    }
}

/// `valid-block-utils.ts` `getBlocks`: the `type` paths of each kind of block.
#[derive(Default)]
struct Locations {
    static_blocks: Vec<Vec<String>>,
    local_blocks: Vec<Vec<String>>,
    theme_blocks: Vec<Vec<String>>,
}

fn get_blocks(valid_schema: &Value) -> Result<Locations, crate::context::CheckError> {
    let mut out = Locations::default();
    if let Some(Value::Array(blocks)) = get(valid_schema, "blocks")? {
        for (index, block) in blocks.iter().enumerate() {
            categorize_block(
                &mut out,
                block,
                vec!["blocks".into(), index.to_string()],
                false,
            )?;
        }
    }
    let presets = get(valid_schema, "presets")?;
    if truthy(presets) {
        for (preset_index, preset) in array(presets, "presets.forEach")?.iter().enumerate() {
            if !has(preset, "blocks")? {
                continue;
            }
            let base = [
                "presets".to_string(),
                preset_index.to_string(),
                "blocks".to_string(),
            ];
            match get(preset, "blocks")? {
                Some(Value::Array(blocks)) => {
                    for (i, block) in blocks.iter().enumerate() {
                        categorize_block(&mut out, block, with(&base, &[&i.to_string()]), true)?;
                    }
                }
                Some(Value::Object(blocks)) => {
                    for (key, block) in blocks {
                        categorize_block(&mut out, block, with(&base, &[key]), true)?;
                    }
                }
                _ => {}
            }
        }
    }
    Ok(out)
}

fn categorize_block(
    out: &mut Locations,
    block: &Value,
    path: Vec<String>,
    in_preset: bool,
) -> CheckResult {
    if !js::truthy(block) {
        return Ok(());
    }
    let type_path = with(&path, &["type"]);
    if has(block, "static")? {
        out.static_blocks.push(type_path);
    } else if has(block, "name")? && !in_preset {
        out.local_blocks.push(type_path);
    } else if !is_str(get(block, "type")?, "@app") {
        out.theme_blocks.push(type_path);
    }
    if has(block, "blocks")? {
        match get(block, "blocks")? {
            Some(Value::Array(blocks)) => {
                for (i, nested) in blocks.iter().enumerate() {
                    categorize_block(
                        out,
                        nested,
                        with(&path, &["blocks", &i.to_string()]),
                        in_preset,
                    )?;
                }
            }
            Some(Value::Object(blocks)) => {
                for (key, nested) in blocks {
                    categorize_block(out, nested, with(&path, &["blocks", key]), in_preset)?;
                }
            }
            _ => {}
        }
    }
    Ok(())
}
