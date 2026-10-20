//! `checks/InvalidBooleanExpressions.ts`

use super::utils::INVALID_SYNTAX_MESSAGE;
use crate::checks::liquid_syntax_error::block::Problem;
use crate::fixes::Fix;
use liquid_ast::{BooleanExpression, Node};

pub fn detect_invalid_boolean_expressions(
    node: &BooleanExpression,
    source: &str,
) -> Option<Problem> {
    let left = match node.condition.as_ref() {
        Node::Comparison(c) => c.left.position(),
        Node::LogicalExpression(l) => l.left.position(),
        _ => return None,
    };
    let (start, end) = (node.position.start, node.position.end);
    let fix = Fix::replace(start, end, &source[left.start..left.end]);
    Some(Problem {
        message: INVALID_SYNTAX_MESSAGE.into(),
        start,
        end,
        fix: Some(fix),
    })
}
