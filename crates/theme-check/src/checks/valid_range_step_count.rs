use super::range_setting::{
    literal_values, property_value, setting_definitions, setting_path, to_range_setting,
    RangeSetting, EPSILON,
};
use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, LiquidCheck, Severity};
use crate::js;
use crate::json::{js_number_to_string, JsonKind, JsonNode, JsonRef};
use liquid_ast::{NodeKind, NodeRef, Span};

const MAX_STEPS: f64 = 101.0;

pub static VALID_RANGE_STEP_COUNT: CheckDef = CheckDef {
    code: "ValidRangeStepCount",
    name: "Validate that range settings have at most 101 steps",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create_liquid),
};

/// `ValidRangeStepCountSettingsSchema`: the same check (and code) for `config/settings_schema.json`.
pub static VALID_RANGE_STEP_COUNT_SETTINGS_SCHEMA: CheckDef = CheckDef {
    create: Create::Json(create_json),
    ..VALID_RANGE_STEP_COUNT
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

        for definitions in setting_definitions(valid_schema) {
            for (i, setting) in definitions.settings.iter().enumerate() {
                let Some(range) = to_range_setting(setting) else {
                    continue;
                };
                if !exceeds_max_steps(&range) {
                    continue;
                }
                // Without a step, the range is too wide for the default step of 1.
                let node = ast
                    .at_path(&setting_path(&definitions.path, i, "step"))
                    .or_else(|| ast.at_path(&setting_path(&definitions.path, i, "max")));
                if let Some(node) = node {
                    let span = node.span();
                    cx.report(
                        too_many_steps_message(&range),
                        Span::new(offset + span.start, offset + span.end),
                    );
                }
            }
        }
        Ok(())
    }
}

struct JsonStepCount;

fn create_json<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    (cx.to_relative_path(cx.uri()) == "config/settings_schema.json")
        .then(|| Box::new(JsonStepCount) as Box<dyn JsonCheck<'a> + 'a>)
}

impl<'a> JsonCheck<'a> for JsonStepCount {
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
            if !exceeds_max_steps(&range) {
                continue;
            }
            let node = property_value(setting, "step").or_else(|| property_value(setting, "max"));
            if let Some(node) = node {
                cx.report(too_many_steps_message(&range), node.span());
            }
        }
        Ok(())
    }
}

fn raw_step_count(range: &RangeSetting) -> f64 {
    (range.max - range.min) / range.step + 1.0
}

fn exceeds_max_steps(range: &RangeSetting) -> bool {
    // EPSILON absorbs float jitter so e.g. step 0.1 across (1, 5) doesn't
    // tip from 41 to 41.00000000000001 and trip the > 101 comparison.
    raw_step_count(range) > MAX_STEPS + EPSILON
}

fn too_many_steps_message(range: &RangeSetting) -> String {
    // The count is over 101 here, where `round` matches `Math.round`.
    let count = raw_step_count(range).round();
    format!(
        "Range setting \"{}\" has {} steps (min {}, max {}, step {}). Shopify allows at most {} steps — use step ≥ {}.",
        range.id,
        js_number_to_string(count),
        js_number_to_string(range.min),
        js_number_to_string(range.max),
        js_number_to_string(range.step),
        js_number_to_string(MAX_STEPS),
        js_number_to_string(smallest_step(range)),
    )
}

/// The smallest step that keeps (max - min) / step + 1 <= 101, rounded up to the 0.1 multiple
/// that the setting schema requires of a step.
fn smallest_step(range: &RangeSetting) -> f64 {
    ((range.max - range.min) / (MAX_STEPS - 1.0) / 0.1 - EPSILON).ceil() / 10.0
}
