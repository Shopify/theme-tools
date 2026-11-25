//! TS `valid-range-default/range-setting.ts`: what ValidRangeDefault and ValidRangeStepCount share.

use crate::json::{JsonNode, Lit, ObjectNode, PathSeg};
use serde_json::{Map, Number, Value};

/// Absorbs float error, so `step: 0.1, default: 4.7` counts as on the grid.
pub const EPSILON: f64 = 1e-9;

/// A `range` setting with numeric bounds.
pub struct RangeSetting<'v> {
    pub id: &'v str,
    pub min: f64,
    pub max: f64,
    /// 1 when the setting has no `step`, as on the storefront.
    pub step: f64,
    pub default: Option<&'v Value>,
}

impl RangeSetting<'_> {
    /// `isFiniteNumber(range.default) ? range.default : undefined`
    pub fn numeric_default(&self) -> Option<f64> {
        finite_number(self.default)
    }
}

/// A list of setting definitions and its path in the schema.
pub struct SettingDefinitions<'v> {
    pub path: Vec<PathSeg<'static>>,
    pub settings: &'v [Value],
}

/// `isFiniteNumber(value) ? value : undefined`
pub fn finite_number(value: Option<&Value>) -> Option<f64> {
    value.and_then(Value::as_f64).filter(|n| n.is_finite())
}

/// `toRangeSetting(setting)`: undefined when it isn't a range setting or its id, min, max or step
/// is invalid.
pub fn to_range_setting(setting: &Value) -> Option<RangeSetting<'_>> {
    let setting = setting.as_object()?;
    if setting.get("type").and_then(Value::as_str) != Some("range") {
        return None;
    }
    let id = setting.get("id")?.as_str()?;
    let min = finite_number(setting.get("min"))?;
    let max = finite_number(setting.get("max"))?;
    let step = match setting.get("step") {
        None => 1.0,
        step => finite_number(step)?,
    };
    if step <= 0.0 {
        return None;
    }
    Some(RangeSetting {
        id,
        min,
        max,
        step,
        default: setting.get("default"),
    })
}

/// `settingDefinitions(schema)`: the schema's own settings, then each local block's.
pub fn setting_definitions(schema: &Value) -> Vec<SettingDefinitions<'_>> {
    let mut result = Vec::new();
    if let Some(settings) = schema.get("settings").and_then(Value::as_array) {
        result.push(SettingDefinitions {
            path: vec![PathSeg::Key("settings")],
            settings,
        });
    }
    if let Some(blocks) = schema.get("blocks").and_then(Value::as_array) {
        for (i, block) in blocks.iter().enumerate() {
            if let Some(settings) = block.get("settings").and_then(Value::as_array) {
                result.push(SettingDefinitions {
                    path: vec![
                        PathSeg::Key("blocks"),
                        PathSeg::Index(i),
                        PathSeg::Key("settings"),
                    ],
                    settings,
                });
            }
        }
    }
    result
}

/// `[...path, i, key]`
pub fn setting_path<'p>(path: &[PathSeg<'p>], i: usize, key: &'p str) -> Vec<PathSeg<'p>> {
    let mut path = path.to_vec();
    path.push(PathSeg::Index(i));
    path.push(PathSeg::Key(key));
    path
}

/// `literalValues(node)`: literal properties as plain values, others as null.
pub fn literal_values(node: &ObjectNode) -> Value {
    let mut values = Map::new();
    for property in &node.children {
        let value = match &property.value {
            JsonNode::Literal(lit) => match &lit.value {
                Lit::Str(s) => Value::String(s.to_string()),
                Lit::Num(n) => Number::from_f64(*n).map_or(Value::Null, Value::Number),
                Lit::Bool(b) => Value::Bool(*b),
                Lit::Null => Value::Null,
            },
            _ => Value::Null,
        };
        values.insert(property.key.value.to_string(), value);
    }
    Value::Object(values)
}

/// `propertyValue(node, key)`: the value of the last `key` property, the one `literalValues` keeps.
pub fn property_value<'n, 'a>(node: &'n ObjectNode<'a>, key: &str) -> Option<&'n JsonNode<'a>> {
    node.children
        .iter()
        .rev()
        .find(|p| p.key.value == key)
        .map(|p| &p.value)
}
