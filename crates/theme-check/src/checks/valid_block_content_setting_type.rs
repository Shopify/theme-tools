use super::schema_utils::{array, get, report_warning};
use crate::block_parameters::{schema_setting_liquid_type, BLOCK_CONTENT_PARAMETER};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::PathSeg::*;
use crate::path;
use crate::schema::is_block;
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static VALID_BLOCK_CONTENT_SETTING_TYPE: CheckDef = CheckDef {
    code: "ValidBlockContentSettingType",
    name: "Valid Block Content Setting Type",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check {
    block_name: String,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    if !is_block(cx.uri()) {
        return None;
    }
    Some(Box::new(Check {
        block_name: path::basename(cx.uri(), Some(".liquid")),
    }))
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
        let Some(schema) = cx.get_block_schema(&self.block_name) else {
            return Ok(());
        };
        let valid_schema = match schema.valid_schema() {
            Some(Err(_)) => return Ok(()),
            _ if schema.ast().is_none() => return Ok(()),
            Some(Ok(Some(v))) if !v.is_null() => v,
            Some(Ok(Some(_))) => {
                return Err(CheckError::new(
                    "Cannot read properties of null (reading 'settings')",
                ))
            }
            _ => {
                return Err(CheckError::new(
                    "Cannot read properties of undefined (reading 'settings')",
                ))
            }
        };
        let Some(ast) = schema.ast() else {
            return Ok(());
        };

        let settings = match get(valid_schema, "settings")? {
            None | Some(Value::Null) => return Ok(()),
            settings => array(settings, "settings.findIndex")?,
        };
        let mut index = None;
        for (i, setting) in settings.iter().enumerate() {
            if get(setting, "id")?.and_then(Value::as_str) == Some(BLOCK_CONTENT_PARAMETER) {
                index = Some(i);
                break;
            }
        }
        let Some(index) = index else { return Ok(()) };

        let setting_type = settings[index]
            .get("type")
            .and_then(Value::as_str)
            .and_then(schema_setting_liquid_type);
        let type_node = ast.at_path(&[Key("settings"), Index(index), Key("type")]);
        let (Some(setting_type), Some(_)) = (setting_type, type_node) else {
            return Ok(());
        };
        if setting_type == "string" {
            return Ok(());
        }
        let message = format!(
            "Schema setting 'content' has Liquid type '{setting_type}', but the built-in 'content' parameter has type 'string'."
        );
        report_warning(cx, message, schema.offset, type_node)
    }
}
