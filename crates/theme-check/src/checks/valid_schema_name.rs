use super::schema_utils::{deep_get, get, report_warning, starts_with};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use crate::json::PathSeg;
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static VALID_SCHEMA_NAME: CheckDef = CheckDef {
    code: "ValidSchemaName",
    name: "Enforce valid schema name",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

const MAX_SCHEMA_NAME_LENGTH: f64 = 25.0;

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

        let name = get(valid_schema, "name")?;
        if !name.is_some_and(js::truthy) {
            return Ok(());
        }
        let name_node = ast.at_path(&[PathSeg::Key("name")]);
        // getLocStart(undefined) throws
        name_node.ok_or_else(|| {
            CheckError::new("Cannot read properties of undefined (reading 'loc')")
        })?;

        if starts_with(name, "t:")? {
            let name = name.and_then(Value::as_str).unwrap_or_default();
            let key: Vec<&str> = name["t:".len()..].split('.').collect();
            let translation = deep_get(cx.default_schema_translations(), &key);
            let Some(translation) = translation else {
                return Ok(());
            };
            if translation.is_null() {
                return Err(CheckError::new(
                    "Cannot read properties of null (reading 'length')",
                ));
            }
            let too_long = match deep_get(Some(&translation), &["length"]).as_deref() {
                Some(Value::Number(n)) => n.as_f64().is_some_and(|n| n > MAX_SCHEMA_NAME_LENGTH),
                // ponytail: `{ length: "30" }` compares as a number in JS; only numbers here.
                _ => false,
            };
            if too_long {
                let message = format!(
                    "Schema name '{}' from 'locales/{}.default.schema.json' is too long (max 25 characters)",
                    js::to_string(&translation),
                    cx.default_locale()
                );
                report_warning(cx, message, offset, name_node)?;
            }
        } else if let Some(Value::String(name)) = name {
            if js::len16(name) as f64 > MAX_SCHEMA_NAME_LENGTH {
                report_warning(
                    cx,
                    format!("Schema name '{name}' is too long (max 25 characters)"),
                    offset,
                    name_node,
                )?;
            }
        }
        Ok(())
    }
}
