//! `checks/liquid-syntax-error/block.ts`

use super::utils::*;
use crate::context::Context;
use crate::fixes::Fix;
use crate::js;
use liquid_ast::{LiquidTag, Markup, NamedArgument, Node, Position};
use liquid_parser::ParseError;
use std::borrow::Cow;

const SYNTAX_ERROR: &str = "Syntax error in 'block' tag";
const BARE_ARRAY_ACCESS: &str = "Bare bracket access is not allowed in strict2 mode";
const DOTTED_ARGUMENT: &str =
    "Liquid syntax error: in 'block' - Use plain named arguments, for example: block 'name', heading: value";
const APP_BLOCK_ARGUMENTS: &str =
    "Liquid syntax error: in 'block' - app blocks do not accept arguments";
const APP_BLOCK_CONTENT: &str =
    "Liquid syntax error: in 'block' - app blocks do not accept content";
const UNCLOSED_BLOCK_PARSER_ERROR: &str =
    "Attempting to end parsing before LiquidTag 'block' was closed";
const UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR: &str =
    "Unclosed block tag 'block' in {% liquid %} block";
const BLOCK_PARSER_ERROR_MESSAGES: &[&str] = &[
    UNCLOSED_BLOCK_PARSER_ERROR,
    UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR,
    "Attempting to close LiquidTag 'block' before it was opened without a matching 'block'",
];

/// TS `Problem`: a message, a byte range and its `fix`.
pub struct Problem {
    pub message: Cow<'static, str>,
    pub start: usize,
    pub end: usize,
    pub fix: Option<Fix>,
}

pub fn check_block_tag(node: &LiquidTag, cx: &mut Context) {
    if let Some(problem) = block_tag_syntax_error(node, cx.source()) {
        cx.report(problem.message, problem.start, problem.end);
    }
}

/// `blockTagSyntaxError(node)`. `source` is the document source (TS `node.source`).
pub fn block_tag_syntax_error(node: &LiquidTag, source: &str) -> Option<Problem> {
    let markup = match &node.markup {
        Markup::Node(n) => match n.as_ref() {
            Node::BlockMarkup(m) => m,
            _ => return syntax_problem(node.position, SYNTAX_ERROR),
        },
        _ => return syntax_problem(node.position, SYNTAX_ERROR),
    };

    // The parser only accepts theme block names and canonical app block paths
    // (shopify://apps/<app>/blocks/<handle>/<uuid>). App blocks render with the settings their app
    // provides, so they take no arguments and no content.
    if is_app_block_path(&markup.name.value) {
        if markup.args.iter().any(|a| a.name != "block.name") {
            return syntax_problem(node.position, APP_BLOCK_ARGUMENTS);
        }
        if has_content(node) {
            return syntax_problem(node.position, APP_BLOCK_CONTENT);
        }
    }

    // Ruby Liquid still accepts the unsupported experimental block.settings.<id> and
    // block.content caller forms. Theme Check intentionally rejects every dotted argument except
    // block.name so authors move to plain arguments. Report the first one so body-form children
    // stay outside the offense.
    if let Some(dotted) = markup.args.iter().find(|a| is_dotted_argument(a)) {
        return syntax_problem(dotted.position, dotted_argument_message(&dotted.name));
    }

    if markup.args.iter().any(is_invalid_block_name_argument) {
        return syntax_problem(node.position, SYNTAX_ERROR);
    }

    // A `BlockArrayLiteral` value is never a bare bracket lookup.
    if markup.args.iter().any(|a| has_bare_array_access(&a.value)) {
        return syntax_problem(node.position, BARE_ARRAY_ACCESS);
    }

    if has_skipped_characters(&Scan::new(raw_markup(source, node.markup_position))) {
        return syntax_problem(node.position, SYNTAX_ERROR);
    }
    None
}

pub fn check_block_parser_error(error: &ParseError, cx: &mut Context, source: &str) {
    if !BLOCK_PARSER_ERROR_MESSAGES.contains(&error.message.as_str()) {
        return;
    }

    let (start, end) = if error
        .message
        .contains(UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR)
    {
        liquid_line_tag_location(source, "block")
            .unwrap_or_else(|| resolve_error_location(error, source))
    } else {
        resolve_error_location(error, source)
    };

    let message = if error.message == UNCLOSED_BLOCK_PARSER_ERROR {
        "Liquid syntax error: 'block' tag was never closed"
    } else {
        &error.message
    };
    cx.report(message, start, end);
}

fn syntax_problem(position: Position, message: impl Into<Cow<'static, str>>) -> Option<Problem> {
    Some(Problem {
        message: message.into(),
        start: position.start,
        end: position.end,
        fix: None,
    })
}

fn is_app_block_path(value: &str) -> bool {
    value.starts_with("shopify://apps/")
}

fn has_content(node: &LiquidTag) -> bool {
    node.children
        .iter()
        .flatten()
        .any(|child| !matches!(child, Node::TextNode(t) if js::trim(&t.value).is_empty()))
}

fn is_invalid_block_name_argument(argument: &NamedArgument) -> bool {
    argument.name == "block.name" && !matches!(argument.value.as_ref(), Node::String(_))
}

fn is_dotted_argument(argument: &NamedArgument) -> bool {
    argument.name != "block.name" && argument.name.contains('.')
}

/// Temporary migration guidance for the experimental block.settings.<id> caller form. Remove it
/// once authors have migrated to plain arguments.
fn dotted_argument_message(name: &str) -> Cow<'static, str> {
    match block_setting_id(name) {
        Some(setting_id) => format!(
            "Liquid syntax error: in 'block' - Use '{setting_id}:' instead of '{name}:' when calling a block."
        )
        .into(),
        None => DOTTED_ARGUMENT.into(),
    }
}

fn block_setting_id(name: &str) -> Option<&str> {
    let mut parts = name.split('.');
    match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some("block"), Some("settings"), Some(id), None) if !id.is_empty() => Some(id),
        _ => None,
    }
}
