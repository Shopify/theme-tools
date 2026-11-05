use super::deprecated_fonts_data::is_deprecated_font;
use super::schema_utils::{
    array, entries, get, has, is_str, node_at, report_warning, s, strict_eq, truthy, with,
};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use crate::json::JsonNode;
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static DEPRECATED_FONTS_ON_SECTIONS_AND_BLOCKS: CheckDef = CheckDef {
    code: "DeprecatedFontsOnSectionsAndBlocks",
    name: "Check for deprecated fonts in section and block schema settings values",
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
        let Some(schema) = cx.get_schema() else {
            return Ok(());
        };
        let Some(valid_schema) = schema.valid_value().filter(|v| js::truthy(v)) else {
            return Ok(());
        };
        let Some(ast) = schema.ast() else {
            return Ok(());
        };
        let w = Walker {
            schema: valid_schema,
            offset: tag.block_start_position.end,
            ast,
        };

        // 1st: schema settings
        let settings = get(valid_schema, "settings")?;
        if truthy(settings) {
            w.check_settings(cx, settings, &["settings".into()])?;
        }

        // 2nd: local block settings
        let blocks = get(valid_schema, "blocks")?;
        if truthy(blocks) {
            for (index, block) in array(blocks, "blocks.forEach")?.iter().enumerate() {
                if has(block, "settings")? && truthy(get(block, "settings")?) {
                    let path = ["blocks".into(), index.to_string(), "settings".into()];
                    w.check_settings(cx, get(block, "settings")?, &path)?;
                }
            }
        }

        // 3rd: presets
        let presets = get(valid_schema, "presets")?;
        if truthy(presets) {
            for (preset_index, preset) in array(presets, "presets.entries")?.iter().enumerate() {
                let settings = get(preset, "settings")?;
                let blocks = if has(preset, "blocks")? {
                    get(preset, "blocks")?
                } else {
                    None
                };
                let path = vec!["presets".into(), preset_index.to_string()];
                w.check_settings_and_blocks(cx, settings, blocks, &path)?;
            }
        }

        // 4th: section default
        if has(valid_schema, "default")? {
            let default_values = get(valid_schema, "default")?;
            if let Some(d) = default_values.filter(|d| js::truthy(d) && js::is_object_like(d)) {
                let blocks = if has(d, "blocks")? {
                    get(d, "blocks")?
                } else {
                    None
                };
                w.check_settings_and_blocks(cx, get(d, "settings")?, blocks, &["default".into()])?;
            }
        }
        Ok(())
    }
}

struct Walker<'v, 'n, 'a> {
    schema: &'v Value,
    offset: usize,
    ast: &'n JsonNode<'a>,
}

impl Walker<'_, '_, '_> {
    fn report(&self, cx: &mut Context, path: &[String], message: String) -> CheckResult {
        report_warning(cx, message, self.offset, node_at(self.ast, path))
    }

    /// `checkSettingsForDeprecatedFonts` (`settings` is truthy).
    fn check_settings(
        &self,
        cx: &mut Context,
        settings: Option<&Value>,
        path: &[String],
    ) -> CheckResult {
        for (index, setting) in array(settings, "settings.forEach")?.iter().enumerate() {
            if !is_str(get(setting, "type")?, "font_picker") {
                continue;
            }
            let Some(font) = get(setting, "default")?
                .and_then(Value::as_str)
                .filter(|f| is_deprecated_font(f))
            else {
                continue;
            };
            let path = with(path, &[&index.to_string(), "default"]);
            let message = format!(
                "setting '{}' is using deprecated font '{font}'",
                s(get(setting, "id")?)
            );
            self.report(cx, &path, message)?;
        }
        Ok(())
    }

    /// `checkSettingsAndBlocksForDeprecatedFonts(settings ?? {}, blocks, ...)`
    fn check_settings_and_blocks(
        &self,
        cx: &mut Context,
        settings: Option<&Value>,
        blocks: Option<&Value>,
        path: &[String],
    ) -> CheckResult {
        if let Some(settings) = settings.filter(|v| js::truthy(v) && js::is_object_like(v)) {
            for (key, value) in entries(settings) {
                if is_font_picker_type(get(self.schema, "settings")?, &key)? {
                    if let Some(font) = value.as_str().filter(|f| is_deprecated_font(f)) {
                        let message = format!("setting '{key}' is using deprecated font '{font}'");
                        self.report(cx, &with(path, &["settings", &key]), message)?;
                    }
                }
            }
        }
        if let Some(blocks) = blocks.filter(|b| js::truthy(b)) {
            self.check_blocks(cx, blocks, path)?;
        }
        Ok(())
    }

    /// `checkBlocksForDeprecatedFonts` (`blocks` is truthy).
    fn check_blocks(&self, cx: &mut Context, blocks: &Value, node_path: &[String]) -> CheckResult {
        for (key, block) in entries(blocks) {
            let block = block.as_ref();
            let current_path = with(node_path, &["blocks", &key]);

            // Local blocks take their settings from this schema; theme blocks from their file.
            let mut valid_schema = None;
            let schema_blocks = get(self.schema, "blocks")?;
            if schema_blocks.is_some_and(|b| !b.is_null()) {
                for schema_block in array(schema_blocks, "forEach")? {
                    if strict_eq(get(schema_block, "type")?, get(block, "type")?)
                        && has(schema_block, "name")?
                    {
                        valid_schema = Some(schema_block);
                    }
                }
            }
            let valid_schema = match valid_schema {
                Some(v) => v,
                None => {
                    let name = s(get(block, "type")?);
                    match cx
                        .get_block_schema(&name)
                        .and_then(|b| b.valid_value())
                        .filter(|v| js::truthy(v))
                    {
                        Some(v) => v,
                        None => continue,
                    }
                }
            };

            if let Some(settings) = get(block, "settings")?.filter(|v| !v.is_null()) {
                for (key, value) in entries(settings) {
                    let Some(font) = value.as_str().filter(|f| is_deprecated_font(f)) else {
                        continue;
                    };
                    if is_font_picker_type(get(valid_schema, "settings")?, &key)? {
                        let message = format!("setting '{key}' is using deprecated font '{font}'");
                        self.report(cx, &with(&current_path, &["settings", &key]), message)?;
                    }
                }
            }

            if has(block, "blocks")? {
                if let Some(nested) = get(block, "blocks")?.filter(|b| js::truthy(b)) {
                    self.check_blocks(cx, nested, &current_path)?;
                }
            }
        }
        Ok(())
    }
}

/// `isFontPickerType(settings ?? [], settingKey)`
fn is_font_picker_type(settings: Option<&Value>, setting_key: &str) -> Result<bool, CheckError> {
    let Some(settings) = settings.filter(|v| !v.is_null()) else {
        return Ok(false);
    };
    for setting in array(Some(settings), "settings.some")? {
        if is_str(get(setting, "id")?, setting_key) && is_str(get(setting, "type")?, "font_picker")
        {
            return Ok(true);
        }
    }
    Ok(false)
}
