use super::schema_utils::{all, array, get, get_blocks, has, s, strict_eq, BlockWithPath};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use crate::json::{JsonNode, PathSeg::*};
use crate::schema::SchemaKind;
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static VALID_SETTINGS_KEY: CheckDef = CheckDef {
    code: "ValidSettingsKey",
    name: "Validate settings key in presets",
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

        let blocks = get_blocks(valid_schema)?;
        let local = &blocks.root_level_local_blocks;
        let schema_settings = get(valid_schema, "settings")?;

        // Preset settings must match schema-level settings. (getBlocks threw unless presets is an array.)
        if let Some(Value::Array(presets)) = get(valid_schema, "presets")? {
            for i in 0..presets.len() {
                let settings_node = ast.at_path(&[Key("presets"), Index(i), Key("settings")]);
                validate_settings_key(cx, offset, settings_node, schema_settings, None)?;
            }
        }

        if schema.kind == SchemaKind::Section && has(valid_schema, "default")? {
            if let Some(default) = get(valid_schema, "default")?.filter(|d| js::truthy(d)) {
                let settings_node = ast.at_path(&[Key("default"), Key("settings")]);
                validate_settings_key(cx, offset, settings_node, schema_settings, None)?;

                // Default block settings must match the block file's settings.
                let default_blocks = get(default, "blocks")?.filter(|b| !b.is_null());
                let default_blocks = match default_blocks {
                    Some(b) => array(Some(b), "map")?,
                    None => &[],
                };
                all(default_blocks.iter().enumerate().map(|(i, block)| {
                    let settings_node =
                        ast.at_path(&[Key("default"), Key("blocks"), Index(i), Key("settings")]);
                    validate_referenced_block(cx, offset, settings_node, local, block)
                }))?;
            }
        }

        // Preset block settings must match the block file's settings.
        for depth in &blocks.preset_level_blocks {
            all(depth.iter().map(|b| {
                let mut path: Vec<_> = b.path[..b.path.len() - 1].iter().map(|s| Key(s)).collect();
                path.push(Key("settings"));
                validate_referenced_block(cx, offset, ast.at_path(&path), local, b.node)
            }))?;
        }
        Ok(())
    }
}

fn validate_referenced_block(
    cx: &mut Context,
    offset: usize,
    settings_node: Option<&JsonNode>,
    local_blocks: &[BlockWithPath],
    referenced_block: &Value,
) -> CheckResult {
    if !local_blocks.is_empty() {
        let ty = get(referenced_block, "type")?;
        let Some(local_block) = local_blocks.iter().find(|b| strict_eq(b.ty(), ty)) else {
            return Ok(());
        };
        return validate_settings_key(
            cx,
            offset,
            settings_node,
            get(local_block.node, "settings")?,
            None,
        );
    }
    let ty = get(referenced_block, "type")?;
    let Some(valid_block_schema) = cx
        .get_block_schema(&s(ty))
        .and_then(|b| b.valid_value())
        .filter(|v| js::truthy(v))
    else {
        return Ok(());
    };
    validate_settings_key(
        cx,
        offset,
        settings_node,
        get(valid_block_schema, "settings")?,
        Some(referenced_block),
    )
}

fn validate_settings_key(
    cx: &mut Context,
    offset: usize,
    settings_node: Option<&JsonNode>,
    valid_settings: Option<&Value>,
    block_node: Option<&Value>,
) -> CheckResult {
    let Some(JsonNode::Object(settings_node)) = settings_node else {
        return Ok(());
    };
    for setting in &settings_node.children {
        // `validSettings?.find((validSetting) => validSetting?.id === setting.key.value)`
        let setting_exists = match valid_settings.filter(|v| !v.is_null()) {
            None => false,
            Some(v) => array(Some(v), "validSettings.find")?
                .iter()
                .any(|vs| vs.get("id").and_then(Value::as_str) == Some(&setting.key.value)),
        };
        if !setting_exists {
            let message = match block_node {
                Some(block) if js::truthy(block) => format!(
                    "Setting '{}' does not exist in 'blocks/{}.liquid'.",
                    setting.key.value,
                    s(get(block, "type")?)
                ),
                _ => format!("Setting '{}' does not exist in schema.", setting.key.value),
            };
            let loc = setting.key.loc;
            cx.report(message, offset + loc.start, offset + loc.end);
        }
    }
    Ok(())
}
