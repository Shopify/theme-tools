//! `checks/InvalidConditionalNodeParenthesis.ts`

use super::utils::{
    does_fragment_contain_unsupported_parentheses, get_fragments_in_markup, index_of,
    INVALID_SYNTAX_MESSAGE,
};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::fixes::{Fix, TextEdit};
use crate::js;
use liquid_ast::{LiquidTag, Markup};

pub fn detect_conditional_node_unsupported_parenthesis(
    node: &LiquidTag,
    source: &str,
) -> Option<Problem> {
    if !matches!(&*node.name, "if" | "elsif" | "unless") {
        return None;
    }
    let Markup::Str(markup) = &node.markup else {
        return None;
    };
    if js::trim(markup).is_empty() {
        return None;
    }

    let fragments = get_fragments_in_markup(markup);
    let mut bad_fragments = fragments
        .iter()
        .filter(|(value, _)| does_fragment_contain_unsupported_parentheses(value))
        .peekable();
    bad_fragments.peek()?;
    let start = index_of(source, markup, node.position.start)?;
    let edits = bad_fragments
        .map(|&(value, i)| TextEdit {
            start: start + i,
            end: start + i + value.len(),
            insert: value.replace(['(', ')'], ""),
        })
        .collect();
    Some(Problem {
        message: INVALID_SYNTAX_MESSAGE.into(),
        start,
        end: start + markup.len(),
        fix: Some(Fix::Text(edits)),
    })
}
