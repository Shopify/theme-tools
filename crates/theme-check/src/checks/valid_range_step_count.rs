use super::range_setting::{
    js_round, last_node_at_path, literal_values, property_value, setting_definitions, setting_path,
    to_range_setting, RangeSetting, EPSILON,
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
                let node = last_node_at_path(ast, &setting_path(&definitions.path, i, "step"))
                    .or_else(|| last_node_at_path(ast, &setting_path(&definitions.path, i, "max")));
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
    let count = js_round(raw_step_count(range));
    let fix = match suggested_step(range) {
        None => format!(
            ", and no step divides this range into 3 to {} steps — change min or max.",
            js_number_to_string(MAX_STEPS)
        ),
        Some(step) => format!(" — try step {}.", js_number_to_string(step)),
    };
    format!(
        "Range setting \"{}\" has {} steps (min {}, max {}, step {}). Shopify allows at most {} steps{fix}",
        range.id,
        js_number_to_string(count),
        js_number_to_string(range.min),
        js_number_to_string(range.max),
        js_number_to_string(range.step),
        js_number_to_string(MAX_STEPS),
    )
}

/// Ranges wider than this, in tenths, get no suggested step, to bound the search.
const MAX_SEARCHED_TENTHS: f64 = 1e12;

/// `suggestedStep(range)`: the smallest step that the storefront accepts for this range. It has at
/// most one decimal digit, divides max - min evenly, and leaves 3 to 101 steps.
fn suggested_step(range: &RangeSetting) -> Option<f64> {
    let tenths = js_round((range.max - range.min) * 10.0);
    if tenths > MAX_SEARCHED_TENTHS {
        return None;
    }
    let tenths = tenths as u64;
    let smallest = (tenths as f64 / (MAX_STEPS - 1.0)).ceil() as u64;
    let mut best: Option<u64> = None;
    let mut divisor = 1;
    while divisor * divisor <= tenths {
        if tenths % divisor == 0 {
            for candidate in [divisor, tenths / divisor] {
                let fits = candidate >= smallest && tenths / candidate + 1 >= 3;
                if fits && best.is_none_or(|b| candidate < b) {
                    best = Some(candidate);
                }
            }
        }
        divisor += 1;
    }
    best.map(|b| b as f64 / 10.0)
}
