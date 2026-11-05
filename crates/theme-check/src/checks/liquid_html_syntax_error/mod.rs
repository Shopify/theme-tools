//! `checks/liquid-html-syntax-error/index.ts`

mod invalid_boolean_expressions;
mod invalid_conditional_node;
mod invalid_conditional_node_parenthesis;
mod invalid_echo_value;
mod invalid_filter_name;
mod invalid_loop_arguments;
mod invalid_loop_range;
mod invalid_pipe_syntax;
mod multiple_assign_values;
pub(super) mod utils;

use crate::checks::liquid_syntax_error::block::Problem;
use crate::checks::liquid_syntax_error::utils::{get_offset, js_slice};
use crate::checks::utils::is_within_raw_tag_that_does_not_parse_its_contents;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::source::Ast;
use invalid_boolean_expressions::detect_invalid_boolean_expressions;
use invalid_conditional_node::detect_invalid_conditional_node;
use invalid_conditional_node_parenthesis::detect_conditional_node_unsupported_parenthesis;
use invalid_echo_value::detect_invalid_echo_value;
use invalid_filter_name::detect_invalid_filter_name;
use invalid_loop_arguments::detect_invalid_loop_arguments;
use invalid_loop_range::detect_invalid_loop_range;
use invalid_pipe_syntax::detect_invalid_pipe_syntax;
use liquid_ast::{NodeKind, NodeRef};
use liquid_parser::ParseError;
use multiple_assign_values::detect_multiple_assign_values;
use regex::Regex;
use std::sync::LazyLock;
use utils::{add16, WS};

pub static LIQUID_HTML_SYNTAX_ERROR: CheckDef = CheckDef {
    code: "LiquidHTMLSyntaxError",
    name: "Prevent LiquidHTML Syntax Errors",
    aliases: &["SyntaxError", "HtmlParsingError"],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

static LINE_COL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"Line [0-9]+, col [0-9]+:[{WS}]+")).unwrap());

struct Check<'a> {
    error: Option<&'a ParseError>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let error = match &cx.file.ast {
        Ast::Liquid(Err(e)) => Some(e),
        _ => None,
    };
    Some(Box::new(Check { error }))
}

fn report(cx: &mut Context, problem: Problem) {
    cx.report_with(
        problem.message,
        problem.start,
        problem.end,
        problem.fix,
        None,
    );
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::BooleanExpression.bit()
            | NodeKind::LiquidTag.bit()
            | NodeKind::LiquidBranch.bit()
            | NodeKind::LiquidVariableOutput.bit()
    }

    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let Some(error) = self.error else {
            return Ok(());
        };
        let source = cx.source();
        match error.loc {
            Some(loc) => {
                let start = get_offset(source, loc.start.line, loc.start.column);
                let mut end = get_offset(source, loc.end.line, loc.end.column);
                if start == end {
                    // ponytail: on a non-BMP char this covers the whole char, TS half of it.
                    end = add16(source, end, 1);
                }
                let highlight = js_slice(source, start, end);
                cx.report(clean_error_message(&error.message, highlight), start, end);
            }
            None => cx.report(&error.message, 0, source.len()),
        }
        Ok(())
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        if self.error.is_some() || is_within_raw_tag_that_does_not_parse_its_contents(ancestors) {
            return Ok(());
        }
        let source = cx.source();
        let docset = cx.docset();
        match node {
            NodeRef::BooleanExpression(node) => {
                if let Some(problem) = detect_invalid_boolean_expressions(node, source) {
                    report(cx, problem);
                }
            }
            NodeRef::LiquidTag(node) => {
                let problems = [
                    detect_multiple_assign_values(node, source),
                    if node.name == "echo" {
                        detect_invalid_echo_value(&node.markup, node.position, source)
                    } else {
                        None
                    },
                    detect_invalid_loop_range(node, source),
                    detect_invalid_loop_arguments(node, source, docset),
                    // Fixers for these two consume the whole node markup, so we MUST not run both.
                    detect_conditional_node_unsupported_parenthesis(node, source).or_else(|| {
                        detect_invalid_conditional_node(
                            Some(&node.name),
                            &node.markup,
                            node.block_start_position,
                            source,
                        )
                    }),
                ];
                problems.into_iter().flatten().for_each(|p| report(cx, p));

                let mut problems = Vec::new();
                detect_invalid_filter_name(
                    Some(&node.name),
                    &node.markup,
                    node.position,
                    source,
                    docset,
                    &mut problems,
                );
                detect_invalid_pipe_syntax(
                    Some(&node.name),
                    &node.markup,
                    node.position,
                    source,
                    &mut problems,
                );
                problems.into_iter().for_each(|p| report(cx, p));
            }
            NodeRef::LiquidBranch(node) => {
                let problem = detect_invalid_conditional_node(
                    node.name.as_deref(),
                    &node.markup,
                    node.block_start_position,
                    source,
                );
                if let Some(problem) = problem {
                    report(cx, problem);
                }
            }
            NodeRef::LiquidVariableOutput(node) => {
                let mut problems = Vec::new();
                detect_invalid_filter_name(
                    None,
                    &node.markup,
                    node.position,
                    source,
                    docset,
                    &mut problems,
                );
                detect_invalid_pipe_syntax(
                    None,
                    &node.markup,
                    node.position,
                    source,
                    &mut problems,
                );
                problems.extend(detect_invalid_echo_value(
                    &node.markup,
                    node.position,
                    source,
                ));
                problems.into_iter().for_each(|p| report(cx, p));
            }
            _ => {}
        }
        Ok(())
    }
}

/// `cleanErrorMessage(message, highlight)`
fn clean_error_message(message: &str, highlight: &str) -> String {
    let message = LINE_COL.replace(message, "SyntaxError: ");
    // `/(?!<expected ".+",) not .*/`: the lookahead never fails before a space, so this is the
    // first ` not ` up to the end of its line.
    let Some(start) = message.find(" not ") else {
        return message.into_owned();
    };
    let end = message[start..]
        .find(['\n', '\r', '\u{2028}', '\u{2029}'])
        .map_or(message.len(), |i| start + i);

    let mut out = String::with_capacity(message.len() + highlight.len());
    out.push_str(&message[..start]);
    // JS `String.prototype.replace` expands `$` patterns in the replacement.
    let replacement = format!(" not \"{highlight}\"");
    let mut chars = replacement.char_indices().peekable();
    while let Some((_, c)) = chars.next() {
        if c != '$' {
            out.push(c);
            continue;
        }
        match chars.peek().map(|&(_, c)| c) {
            Some('$') => out.push('$'),
            Some('&') => out.push_str(&message[start..end]),
            Some('`') => out.push_str(&message[..start]),
            Some('\'') => out.push_str(&message[end..]),
            _ => {
                out.push('$');
                continue;
            }
        }
        chars.next();
    }
    out.push_str(&message[end..]);
    out
}

#[cfg(test)]
mod tests {
    use super::clean_error_message;

    #[test]
    fn clean_messages() {
        assert_eq!(
            clean_error_message("Line 1, col 5:  expected \"x\", not \"y\"\nmore", "z"),
            "SyntaxError: expected \"x\", not \"z\"\nmore"
        );
        assert_eq!(
            clean_error_message("a not b", "$$ $& $` $' $1"),
            "a not \"$  not b a  $1\""
        );
        assert_eq!(clean_error_message("plain", "z"), "plain");
    }
}
