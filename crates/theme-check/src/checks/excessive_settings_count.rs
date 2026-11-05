use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::{js_number_to_string, to_json_node, JsonNode};
use crate::visitor::walk;
use liquid_ast::NodeRef;

pub static EXCESSIVE_SETTINGS_COUNT: CheckDef = CheckDef {
    code: "ExcessiveSettingsCount",
    name: "ExcessiveSettingsCount",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[("maxSettings", "40")],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let Some(doc) = cx.file.liquid_ast() else {
            return Ok(());
        };
        let Some(schema_node) = walk(NodeRef::Document(doc)).find_map(|n| match n {
            NodeRef::LiquidRawTag(tag) if tag.name == "schema" => Some(tag),
            _ => None,
        }) else {
            return Ok(());
        };
        let Ok(JsonNode::Object(schema_ast)) = to_json_node(&schema_node.body.value) else {
            return Ok(());
        };
        let Some(JsonNode::Array(settings)) = schema_ast.get("settings").map(|p| &p.value) else {
            return Ok(());
        };

        // Only top-level settings with an id: headers and paragraphs don't count, and block or
        // preset settings are authored separately.
        let settings_count = settings
            .children
            .iter()
            .filter(|s| matches!(s, JsonNode::Object(o) if o.children.iter().any(|p| p.key.value == "id")))
            .count();

        let max_settings = cx.setting_f64("maxSettings");
        if max_settings.is_some_and(|max| settings_count as f64 <= max) {
            return Ok(());
        }
        cx.report(
            format!(
                "This schema declares {settings_count} settings, which exceeds the maximum of {}. Consider splitting this section or block into smaller pieces, or grouping related options with a header.",
                max_settings.map_or("undefined".into(), js_number_to_string)
            ),
            schema_node.block_start_position.start,
            schema_node.block_start_position.end,
        );
        Ok(())
    }
}
