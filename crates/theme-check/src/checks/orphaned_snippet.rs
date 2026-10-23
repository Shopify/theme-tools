use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::schema::is_snippet;

pub static ORPHANED_SNIPPET: CheckDef = CheckDef {
    code: "OrphanedSnippet",
    name: "Prevent orphaned snippets",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let uri = cx.file.uri.as_str();
        if !is_snippet(uri) {
            return Ok(());
        }
        let Some(references) = cx.deps.get_references(uri) else {
            return Ok(());
        };
        if references.is_empty() {
            // TS `endIndex: 1` is a UTF-16 index; past the end of an empty file it's byte 1 too.
            // ponytail: TS ends an astral first char mid surrogate (index 1); byte offsets can't,
            // so this ends after it (index 2).
            let end = cx.source().chars().next().map_or(1, char::len_utf8);
            cx.report("This snippet is not referenced by any other files", 0, end);
        }
        Ok(())
    }
}
