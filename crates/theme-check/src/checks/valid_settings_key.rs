use super::schema_utils::{all, array, get, get_blocks, has, s, strict_eq, BlockWithPath};
use crate::context::{
    CheckDef, CheckError, CheckResult, Context, Create, JsonCheck, LiquidCheck, Severity,
};
use crate::js;
use crate::json::{JsonNode, PathSeg, PathSeg::*};
use crate::schema::{get_schema_from_json, SchemaKind};
use liquid_ast::{NodeKind, NodeRef, Span};
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

/// The same check on the section and block settings of JSON templates.
pub static VALID_SETTINGS_KEY_JSON: CheckDef = CheckDef {
    create: Create::Json(create_json),
    ..VALID_SETTINGS_KEY
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn kinds(&self) -> &'static [NodeKind] {
        &[NodeKind::LiquidRawTag]
    }

    fn enter(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidRawTag(tag) = node else {
            return Ok(());
        };
        if tag.name != "schema" || tag.body.kind != "json" {
            return Ok(());
        }
        let offset = tag.start_tag.end;
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
                validate_settings_key(cx, offset, settings_node, schema_settings, None, "schema")?;
            }
        }

        if schema.kind == SchemaKind::Section && has(valid_schema, "default")? {
            if let Some(default) = get(valid_schema, "default")?.filter(|d| js::truthy(d)) {
                let settings_node = ast.at_path(&[Key("default"), Key("settings")]);
                validate_settings_key(cx, offset, settings_node, schema_settings, None, "schema")?;

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

struct JsonTemplateCheck;

fn create_json<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    cx.to_relative_path(cx.uri())
        .starts_with("templates/")
        .then(|| Box::new(JsonTemplateCheck) as Box<dyn JsonCheck<'a> + 'a>)
}

impl<'a> JsonCheck<'a> for JsonTemplateCheck {
    fn end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let (parsed, ast) = get_schema_from_json(cx);
        let Some(ast) = ast else { return Ok(()) };
        let parsed = parsed.ok_or_else(|| {
            CheckError::new("Cannot read properties of undefined (reading 'sections')")
        })?;
        let Some(sections) = get(&parsed, "sections")?.filter(|s| js::truthy(s)) else {
            return Ok(());
        };
        let entries = js::entries(sections).map_err(CheckError)?;
        all(entries.iter().map(|(key, section)| {
            if !js::is_non_null_object(section) || !has(section, "type")? {
                return Ok(());
            }
            let ty = get(section, "type")?;
            let Some(valid_schema) = cx
                .get_section_schema(&s(ty))
                .and_then(|schema| schema.valid_value())
                .filter(|v| js::truthy(v))
            else {
                return Ok(());
            };
            let schema_path = format!("'sections/{}.liquid'", s(ty));
            if has(section, "settings")? {
                let settings_node = ast.at_path(&[Key("sections"), Key(key), Key("settings")]);
                let valid_settings = get(valid_schema, "settings")?;
                validate_settings_key(cx, 0, settings_node, valid_settings, None, &schema_path)?;
            }
            if has(section, "blocks")? {
                if let Some(blocks) = get(section, "blocks")?.filter(|b| js::is_non_null_object(b))
                {
                    let path = ["sections", &**key, "blocks"].map(String::from);
                    validate_template_blocks_settings(
                        cx,
                        ast,
                        blocks,
                        valid_schema,
                        &path,
                        &schema_path,
                    )?;
                }
            }
            Ok(())
        }))
    }
}

/// Checks each block's settings against its local block in `parent_schema`, or else against
/// its theme block file, then does the same for the block's own blocks.
fn validate_template_blocks_settings(
    cx: &mut Context,
    ast: &JsonNode,
    blocks: &Value,
    parent_schema: &Value,
    path: &[String],
    parent_schema_path: &str,
) -> CheckResult {
    let entries = js::entries(blocks).map_err(CheckError)?;
    all(entries.iter().map(|(key, block)| {
        if !js::is_non_null_object(block) || !has(block, "type")? {
            return Ok(());
        }
        let ty = get(block, "type")?;
        let block_path: Vec<String> = path.iter().cloned().chain([key.to_string()]).collect();
        let at = |last: &'static str| {
            let segs: Vec<PathSeg> = block_path
                .iter()
                .map(String::as_str)
                .chain([last])
                .map(Key)
                .collect();
            ast.at_path(&segs)
        };
        let nested_path: Vec<String> = block_path
            .iter()
            .cloned()
            .chain(["blocks".into()])
            .collect();
        let nested_blocks = if has(block, "blocks")? {
            get(block, "blocks")?.filter(|b| js::is_non_null_object(b))
        } else {
            None
        };

        // `parentSchema.blocks?.find((b) => b.type === block.type && 'name' in b)`
        let mut local_block = None;
        if let Some(schema_blocks) = get(parent_schema, "blocks")?.filter(|b| !b.is_null()) {
            for schema_block in array(Some(schema_blocks), "parentSchema.blocks.find")? {
                if strict_eq(get(schema_block, "type")?, ty) && has(schema_block, "name")? {
                    local_block = Some(schema_block);
                    break;
                }
            }
        }

        if let Some(local_block) = local_block {
            let valid_settings = get(local_block, "settings")?;
            validate_settings_key(
                cx,
                0,
                at("settings"),
                valid_settings,
                None,
                parent_schema_path,
            )?;
            if let Some(nested) = nested_blocks {
                validate_template_blocks_settings(
                    cx,
                    ast,
                    nested,
                    local_block,
                    &nested_path,
                    parent_schema_path,
                )?;
            }
            return Ok(());
        }

        let Some(valid_schema) = cx
            .get_block_schema(&s(ty))
            .and_then(|schema| schema.valid_value())
            .filter(|v| js::truthy(v))
        else {
            return Ok(());
        };
        let valid_settings = get(valid_schema, "settings")?;
        validate_settings_key(cx, 0, at("settings"), valid_settings, Some(block), "schema")?;
        if let Some(nested) = nested_blocks {
            let schema_path = format!("'blocks/{}.liquid'", s(ty));
            validate_template_blocks_settings(
                cx,
                ast,
                nested,
                valid_schema,
                &nested_path,
                &schema_path,
            )?;
        }
        Ok(())
    }))
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
            "schema",
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
        "schema",
    )
}

fn validate_settings_key(
    cx: &mut Context,
    offset: usize,
    settings_node: Option<&JsonNode>,
    valid_settings: Option<&Value>,
    block_node: Option<&Value>,
    schema_path: &str,
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
                _ => format!(
                    "Setting '{}' does not exist in {schema_path}.",
                    setting.key.value
                ),
            };
            let span = setting.key.span;
            cx.report(message, Span::new(offset + span.start, offset + span.end));
        }
    }
    Ok(())
}
