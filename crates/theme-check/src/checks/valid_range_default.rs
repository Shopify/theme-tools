use super::range_setting::{
    finite_number, js_round, last_node_at_path, literal_values, property_value,
    setting_definitions, setting_path, to_range_setting, RangeSetting, EPSILON,
};
use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, LiquidCheck, Severity};
use crate::js;
use crate::json::{js_number_to_string, JsonKind, JsonNode, JsonRef, Lit, PathSeg};
use crate::schema::SchemaKind;
use liquid_ast::{NodeKind, NodeRef, Span};
use std::collections::HashMap;

pub static VALID_RANGE_DEFAULT: CheckDef = CheckDef {
    code: "ValidRangeDefault",
    name: "Validate default values and preset values for range settings",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create_liquid),
};

/// `ValidRangeDefaultSettingsSchema`: the same check (and code) for `config/settings_schema.json`.
pub static VALID_RANGE_DEFAULT_SETTINGS_SCHEMA: CheckDef = CheckDef {
    create: Create::Json(create_json),
    ..VALID_RANGE_DEFAULT
};

struct Check;

fn create_liquid<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
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
        let Some(schema) = cx.get_schema() else {
            return Ok(());
        };
        let Some(valid_schema) = schema.valid_value().filter(|v| js::truthy(v)) else {
            return Ok(());
        };
        let Some(ast) = schema.ast() else {
            return Ok(());
        };
        let offset = tag.start_tag.end;
        let report = |cx: &mut Context, node: Option<&JsonNode>, message: String| {
            if let Some(node) = node {
                let span = node.span();
                cx.report(message, Span::new(offset + span.start, offset + span.end));
            }
        };

        // 1. The defaults of the schema's settings and of its local blocks' settings
        for definitions in setting_definitions(valid_schema) {
            for (i, setting) in definitions.settings.iter().enumerate() {
                let Some(range) = to_range_setting(setting) else {
                    continue;
                };
                let Some(default) = range.numeric_default() else {
                    continue;
                };
                let Some(problem) = range_problem(&range, default) else {
                    continue;
                };
                report(
                    cx,
                    last_node_at_path(ast, &setting_path(&definitions.path, i, "default")),
                    default_message(&range, default, &problem),
                );
            }
        }

        // 2. The values that presets and a section's default give the schema's settings
        let mut range_settings = HashMap::new();
        for setting in valid_schema
            .get("settings")
            .and_then(|s| s.as_array())
            .map_or(&[][..], Vec::as_slice)
        {
            if let Some(range) = to_range_setting(setting) {
                range_settings.insert(range.id, range);
            }
        }
        if range_settings.is_empty() {
            return Ok(());
        }

        let mut value_paths = Vec::new();
        if let Some(presets) = valid_schema.get("presets").and_then(|p| p.as_array()) {
            for i in 0..presets.len() {
                value_paths.push(vec![
                    PathSeg::Key("presets"),
                    PathSeg::Index(i),
                    PathSeg::Key("settings"),
                ]);
            }
        }
        if schema.kind == SchemaKind::Section {
            value_paths.push(vec![PathSeg::Key("default"), PathSeg::Key("settings")]);
        }

        for path in value_paths {
            let Some(JsonNode::Object(settings_node)) = last_node_at_path(ast, &path) else {
                continue;
            };
            for property in &settings_node.children {
                let Some(range) = range_settings.get(property.key.value.as_ref()) else {
                    continue;
                };
                let JsonNode::Literal(lit) = &property.value else {
                    continue;
                };
                let Lit::Num(value) = lit.value else {
                    continue;
                };
                if !value.is_finite() {
                    continue;
                }
                let Some(problem) = range_problem(range, value) else {
                    continue;
                };
                report(
                    cx,
                    Some(&property.value),
                    format!(
                        "Value {} for range setting \"{}\" {problem}.",
                        js_number_to_string(value),
                        range.id
                    ),
                );
            }
        }
        Ok(())
    }
}

struct JsonRangeDefault;

fn create_json<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    (cx.to_relative_path(cx.uri()) == "config/settings_schema.json")
        .then(|| Box::new(JsonRangeDefault) as Box<dyn JsonCheck<'a> + 'a>)
}

impl<'a> JsonCheck<'a> for JsonRangeDefault {
    fn kinds(&self) -> &'static [JsonKind] {
        &[JsonKind::Property]
    }

    fn enter(&mut self, node: JsonRef<'a>, _: &[JsonRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let JsonRef::Property(prop) = node else {
            return Ok(());
        };
        if prop.key.value != "settings" {
            return Ok(());
        }
        let JsonNode::Array(settings) = &prop.value else {
            return Ok(());
        };
        for setting in &settings.children {
            let JsonNode::Object(setting) = setting else {
                continue;
            };
            let values = literal_values(setting);
            let Some(range) = to_range_setting(&values) else {
                continue;
            };
            let Some(default) = finite_number(range.default) else {
                continue;
            };
            let Some(problem) = range_problem(&range, default) else {
                continue;
            };
            if let Some(default_node) = property_value(setting, "default") {
                cx.report(
                    default_message(&range, default, &problem),
                    default_node.span(),
                );
            }
        }
        Ok(())
    }
}

fn default_message(range: &RangeSetting, default: f64, problem: &str) -> String {
    format!(
        "Default value {} for range setting \"{}\" {problem}.",
        js_number_to_string(default),
        range.id
    )
}

fn range_problem(setting: &RangeSetting, value: f64) -> Option<String> {
    let (min, max) = (
        js_number_to_string(setting.min),
        js_number_to_string(setting.max),
    );
    if value < setting.min || value > setting.max {
        return Some(format!("is outside the range [{min}, {max}]"));
    }
    if !is_on_step_grid(setting, value) {
        return Some(format!(
            "is not aligned to step {} in range [{min}, {max}] — try {}",
            js_number_to_string(setting.step),
            js_number_to_string(nearest_valid_value(setting, value))
        ));
    }
    None
}

fn is_on_step_grid(setting: &RangeSetting, value: f64) -> bool {
    let ratio = (value - setting.min) / setting.step;
    (ratio - js_round(ratio)).abs() < EPSILON
}

/// `nearestValidValue(setting, value)`: the grid value nearest to `value`, which is within
/// [min, max], kept at or below `max` and at one decimal digit.
fn nearest_valid_value(setting: &RangeSetting, value: f64) -> f64 {
    let last_index = ((setting.max - setting.min) / setting.step + EPSILON).floor();
    let index = last_index.min(js_round((value - setting.min) / setting.step));
    js_round((setting.min + index * setting.step) * 10.0) / 10.0
}
