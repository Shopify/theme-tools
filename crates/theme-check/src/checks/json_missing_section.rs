use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, Severity};
use crate::json::{JsonNode, Lit};

pub static JSON_MISSING_SECTION: CheckDef = CheckDef {
    code: "JSONMissingSection",
    name: "Check for missing section files in JSON templates and section groups",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Json(create),
};

const SECTION_TYPES_WITH_PLATFORM_DEFAULTS: &[&str] = &["apps", "_blocks"];

struct Check;

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    let relative_path = cx.to_relative_path(cx.uri());
    (relative_path.starts_with("templates/") || relative_path.starts_with("sections/"))
        .then(|| Box::new(Check) as Box<dyn JsonCheck<'a> + 'a>)
}

impl<'a> JsonCheck<'a> for Check {
    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let Some(JsonNode::Object(sections)) = cx
            .file
            .json_ast()
            .and_then(|ast| ast.at_path(&["sections".into()]))
        else {
            return Ok(());
        };
        for property in &sections.children {
            let JsonNode::Object(section) = &property.value else {
                continue;
            };
            let Some(JsonNode::Literal(type_node)) = section.get("type").map(|p| &p.value) else {
                continue;
            };
            let Lit::Str(section_type) = &type_node.value else {
                continue;
            };
            if SECTION_TYPES_WITH_PLATFORM_DEFAULTS.contains(&section_type.as_ref())
                || cx.file_exists(&cx.to_uri(&format!("sections/{section_type}.liquid")))
            {
                continue;
            }
            cx.report(
                format!("Section type '{section_type}' does not refer to an existing section file"),
                type_node.loc.start,
                type_node.loc.end,
            );
        }
        Ok(())
    }
}
