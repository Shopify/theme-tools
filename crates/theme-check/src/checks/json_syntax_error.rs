use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, Severity};
use crate::json::{ErrorCode, ParseError};
use crate::source::Ast;

pub static JSON_SYNTAX_ERROR: CheckDef = CheckDef {
    code: "JSONSyntaxError",
    name: "Enforce valid JSON",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: true,
    schema: &[],
    create: Create::Json(create),
};

struct Check<'a> {
    errors: &'a [ParseError],
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    // If available, the JSON validator (ValidJSON) reports these instead.
    if cx.deps.json_validator.is_some() {
        return None;
    }
    match &cx.file.ast {
        Ast::Json(Err(e)) => Some(Box::new(Check { errors: &e.errors })),
        _ => None,
    }
}

impl<'a> JsonCheck<'a> for Check<'a> {
    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        for e in self.errors {
            cx.report(message(e.error), e.offset, e.offset + e.length);
        }
        Ok(())
    }
}

fn message(code: ErrorCode) -> &'static str {
    use ErrorCode::*;
    match code {
        InvalidSymbol => "Invalid symbol",
        InvalidNumberFormat => "Invalid number format",
        PropertyNameExpected => "Property name expected",
        ValueExpected => "Expecting a value",
        ColonExpected => "Expecting a colon after a property name (:)",
        CommaExpected => "Expecting a comma",
        CloseBraceExpected => "Expecting a closing brace (})",
        CloseBracketExpected => "Expecting a closing bracket (])",
        EndOfFileExpected => "Expecting end of file",
        InvalidCommentToken => "Invalid comment token",
        UnexpectedEndOfComment => "Unexpected end of comment",
        UnexpectedEndOfString => "Unexpected end of string",
        UnexpectedEndOfNumber => "Unexpected end of number",
        InvalidUnicode => "Invalid unicode",
        InvalidEscapeCharacter => "Invalid escape character",
        InvalidCharacter => "Invalid character",
    }
}
