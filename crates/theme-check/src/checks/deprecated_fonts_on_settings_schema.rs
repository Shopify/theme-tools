use super::deprecated_fonts_data::is_deprecated_font;
use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, Severity};
use crate::json::{JsonKind, JsonNode, JsonRef, Lit};

pub static DEPRECATED_FONTS_ON_SETTINGS_SCHEMA: CheckDef = CheckDef {
    code: "DeprecatedFontsOnSettingsSchema",
    name: "Check for deprecated fonts in settings_schema settings values",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Json(create),
};

struct Check;

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    (cx.to_relative_path(cx.uri()) == "config/settings_schema.json")
        .then(|| Box::new(Check) as Box<dyn JsonCheck<'a> + 'a>)
}

impl<'a> JsonCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        JsonKind::Property.bit()
    }

    fn node(&mut self, node: JsonRef<'a>, _: &[JsonRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let JsonRef::Property(prop) = node else {
            return Ok(());
        };
        let JsonNode::Array(settings) = &prop.value else {
            return Ok(());
        };
        if prop.key.value != "settings" {
            return Ok(());
        }
        for setting in &settings.children {
            let JsonNode::Object(setting) = setting else {
                continue;
            };
            let is_font_picker = setting
                .get("type")
                .is_some_and(|t| matches!(&t.value, JsonNode::Literal(l) if l.value.as_str() == Some("font_picker")));
            if !is_font_picker {
                continue;
            }
            let Some(JsonNode::Literal(default)) = setting.get("default").map(|p| &p.value) else {
                continue;
            };
            if let Lit::Str(font) = &default.value {
                if is_deprecated_font(font) {
                    cx.report(
                        format!("The font \"{font}\" is deprecated"),
                        default.loc.start,
                        default.loc.end,
                    );
                }
            }
        }
        Ok(())
    }
}
