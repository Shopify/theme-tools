use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, JsonCheck, Severity};
use crate::json_validator::JsonValidator;

pub static VALID_JSON: CheckDef = CheckDef {
    code: "ValidJSON",
    name: "Enforce valid JSON",
    aliases: &["ValidJson"],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Json(create),
};

struct Check<'a> {
    validator: &'a JsonValidator,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    Some(Box::new(Check {
        validator: cx.deps.json_validator.as_ref()?,
    }))
}

impl<'a> JsonCheck<'a> for Check<'a> {
    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        for p in self
            .validator
            .validate(&cx.file.uri, cx.file.source)
            .map_err(CheckError)?
        {
            cx.report(p.message, p.start, p.end);
        }
        Ok(())
    }
}
