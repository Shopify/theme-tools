//! `checks/valid-visible-if/visible-if-utils.ts` (the parts shared by more than one check).

use crate::visitor::walk;
use liquid_ast::{Markup, Node, NodeRef, VariableLookup};
use regex::Regex;
use std::sync::LazyLock;

/// `/{{(.+?)}}/` (`.` stops at line terminators in JS).
pub static VARIABLE_EXPRESSION_MATCHER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{([^\n\r\u{2028}\u{2029}]+?)\}\}").unwrap());
pub const ADJUSTED_PREFIX: &str = "{% if ";
pub const ADJUSTED_SUFFIX: &str = " %}{% endif %}";
/// `'{{'.length - adjustedPrefix.length`: add to lookup positions to get offsets in the
/// `visible_if` string (relative to the match start).
pub const OFFSET_ADJUST: isize = 2 - ADJUSTED_PREFIX.len() as isize;

/// The result of `getVariableLookupsInExpression`.
pub enum VisibleIfLookups<'d> {
    /// Lookups in visit order. Positions are in the adjusted `{% if ... %}` source.
    Lookups(Vec<&'d VariableLookup<'d>>),
    /// `{ warning }`
    Warning(String),
    /// `null`: a literal `true` / `false`.
    Null,
}

/// `getVariableLookupsInExpression(expression)`. The parsed AST borrows a temporary, so the
/// result goes to `f`. TS passes `mode: 'strict'`, but `toLiquidHtmlAST` never reads it, so the
/// default parse is identical.
pub fn with_variable_lookups_in_expression<R>(
    expression: &str,
    f: impl FnOnce(VisibleIfLookups<'_>) -> R,
) -> R {
    let Some(m) = VARIABLE_EXPRESSION_MATCHER.captures(expression) else {
        return f(VisibleIfLookups::Warning(
            "Invalid visible_if expression. It should take the form \"{{ <expression> }}\".".into(),
        ));
    };
    let adjusted = format!("{ADJUSTED_PREFIX}{}{ADJUSTED_SUFFIX}", &m[1]);
    let syntax_error =
        || VisibleIfLookups::Warning("Syntax error: cannot parse visible_if expression.".into());
    let Ok(doc) = liquid_parser::to_liquid_html_ast(&adjusted) else {
        return f(syntax_error());
    };
    if doc.children.len() != 1 {
        return f(VisibleIfLookups::Warning(
            "Error: Unexpected child count for DocumentNode".into(),
        ));
    }
    let Node::LiquidTag(if_tag) = &doc.children[0] else {
        return f(VisibleIfLookups::Warning(
            "Error: Expected DocumentNode to contain 'if' tag".into(),
        ));
    };
    if if_tag.name != "if" {
        return f(VisibleIfLookups::Warning(
            "Error: Expected DocumentNode to contain 'if' tag".into(),
        ));
    }
    match &if_tag.markup {
        Markup::Str(_) => return f(syntax_error()),
        Markup::Node(n) if matches!(n.as_ref(), Node::LiquidLiteral(l) if l.keyword == "true" || l.keyword == "false") => {
            return f(VisibleIfLookups::Null)
        }
        _ => {}
    }
    let vars: Vec<&VariableLookup> = walk(NodeRef::LiquidTag(if_tag))
        .filter_map(|n| match n {
            NodeRef::VariableLookup(v) => Some(v),
            _ => None,
        })
        .collect();
    if vars.is_empty() {
        return f(VisibleIfLookups::Warning(
            "visible_if expression contains no references to any settings. This is likely an error.".into(),
        ));
    }
    f(VisibleIfLookups::Lookups(vars))
}
