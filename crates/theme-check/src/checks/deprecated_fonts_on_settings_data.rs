use super::deprecated_fonts_data::is_deprecated_font;
use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, Severity};
use crate::json::{JsonKind, JsonNode, JsonRef, Lit};

pub static DEPRECATED_FONTS_ON_SETTINGS_DATA: CheckDef = CheckDef {
    code: "DeprecatedFontsOnSettingsData",
    name: "Check for deprecated fonts in settings_data settings values",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Json(create),
};

struct Check;

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    (cx.to_relative_path(cx.uri()) == "config/settings_data.json")
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
        if let JsonNode::Literal(lit) = &prop.value {
            if let Lit::Str(font) = &lit.value {
                if is_deprecated_font(font) {
                    cx.report(
                        format!("The font \"{font}\" is deprecated"),
                        lit.loc.start,
                        lit.loc.end,
                    );
                }
            }
        }
        Ok(())
    }
}
