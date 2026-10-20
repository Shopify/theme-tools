use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, Severity};
use crate::json::{JsonKind, JsonRef, Lit};
use regex::Regex;
use std::sync::LazyLock;

pub static VALID_HTML_TRANSLATION: CheckDef = CheckDef {
    code: "ValidHTMLTranslation",
    name: "Valid HTML Translation",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Json(create),
};

static HTML_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<[^>]+>").unwrap());

struct Check;

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    cx.to_relative_path(cx.uri())
        .starts_with("locales/")
        .then(|| Box::new(Check) as Box<dyn JsonCheck<'a> + 'a>)
}

impl<'a> JsonCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        JsonKind::Literal.bit()
    }

    fn node(&mut self, node: JsonRef<'a>, _: &[JsonRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let JsonRef::Literal(lit) = node else {
            return Ok(());
        };
        let Lit::Str(value) = &lit.value else {
            return Ok(());
        };
        if !HTML_REGEX.is_match(value) {
            return Ok(());
        }
        if let Err(error) = liquid_parser::to_liquid_html_ast(value) {
            cx.report(format!("{error}."), lit.loc.start, lit.loc.end);
        }
        Ok(())
    }
}
