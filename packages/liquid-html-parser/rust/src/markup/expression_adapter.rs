//! Port of `src/markup/expression-adapter.ts`.
//!
//! The markup parser builds binary expressions in this parser-internal shape,
//! and the adapters turn them into AST nodes. An adapted node takes the
//! binary expression's `position` object itself, not a copy, as TS does, so
//! `BooleanExpression.position` and its `condition.position` are one object.

use crate::types::{Comparators, NodeTypes};
use crate::value::{JsVal, obj};

/// TS `LogicalOperator`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LogicalOperator {
    And,
    Or,
}

impl LogicalOperator {
    /// TS `isLogicalOp`: membership in `LOGICAL_OPERATORS`.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "and" => Some(LogicalOperator::And),
            "or" => Some(LogicalOperator::Or),
            _ => None,
        }
    }
}

/// TS `EqualityOperator | ComparisonOperator`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ComparisonOp {
    Equal,
    NotEqual,
    LessThan,
    GreaterThan,
    LessThanOrEqual,
    GreaterThanOrEqual,
    Contains,
}

impl ComparisonOp {
    /// TS `isComparisonOp`: membership in `EQUALITY_OPERATORS` or
    /// `COMPARISON_OPERATORS`.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "==" => Some(ComparisonOp::Equal),
            "!=" => Some(ComparisonOp::NotEqual),
            "<" => Some(ComparisonOp::LessThan),
            ">" => Some(ComparisonOp::GreaterThan),
            "<=" => Some(ComparisonOp::LessThanOrEqual),
            ">=" => Some(ComparisonOp::GreaterThanOrEqual),
            "contains" => Some(ComparisonOp::Contains),
            _ => None,
        }
    }
}

/// TS `ComparisonBinaryExpression`. `source` is always the parse input, so it
/// is not stored.
pub struct ComparisonBinaryExpression {
    pub left: JsVal,
    pub op: ComparisonOp,
    pub right: JsVal,
    pub position: JsVal,
}

/// TS `LogicalBinaryExpression`.
pub struct LogicalBinaryExpression {
    pub left: Expression,
    pub op: LogicalOperator,
    pub right: Expression,
    pub op_start: usize,
    pub position: JsVal,
}

/// TS `Expression`: a binary expression or a leaf value node.
pub enum Expression {
    Comparison(Box<ComparisonBinaryExpression>),
    Logical(Box<LogicalBinaryExpression>),
    Value(JsVal),
}

impl Expression {
    /// TS `node.position`, the object itself.
    pub fn position(&self) -> JsVal {
        match self {
            Expression::Comparison(node) => node.position.clone(),
            Expression::Logical(node) => node.position.clone(),
            Expression::Value(node) => node.get("position"),
        }
    }

    pub fn start(&self) -> usize {
        self.position().get("start").offset()
    }

    pub fn end(&self) -> usize {
        self.position().get("end").offset()
    }
}

fn to_relation(op: LogicalOperator) -> &'static str {
    match op {
        LogicalOperator::And => "and",
        LogicalOperator::Or => "or",
    }
}

fn to_comparators(op: ComparisonOp) -> Comparators {
    match op {
        ComparisonOp::Equal => Comparators::Equal,
        ComparisonOp::NotEqual => Comparators::NotEqual,
        ComparisonOp::LessThan => Comparators::LessThan,
        ComparisonOp::GreaterThan => Comparators::GreaterThan,
        ComparisonOp::LessThanOrEqual => Comparators::LessThanOrEqual,
        ComparisonOp::GreaterThanOrEqual => Comparators::GreaterThanOrEqual,
        ComparisonOp::Contains => Comparators::Contains,
    }
}

pub fn adapt_conditional(node: Expression) -> JsVal {
    match node {
        Expression::Value(value) => value,
        Expression::Logical(node) => adapt_logical(*node),
        Expression::Comparison(node) => obj! {
            "type" => JsVal::node_type(NodeTypes::Comparison),
            "comparator" => JsVal::str(to_comparators(node.op).as_str()),
            "left" => node.left,
            "right" => node.right,
            "position" => node.position,
            "source" => JsVal::Null,
        },
    }
}

fn adapt_logical(node: LogicalBinaryExpression) -> JsVal {
    let right = adapt_conditional(node.right);
    // The original parser sets a nested LogicalExpression's position.start
    // to include the preceding operator keyword (`and`/`or`).
    if right.type_is(NodeTypes::LogicalExpression.as_str()) {
        let position = right.get("position").spread();
        position.set("start", JsVal::Offset(node.op_start));
        right.set("position", position);
    }
    obj! {
        "type" => JsVal::node_type(NodeTypes::LogicalExpression),
        "relation" => JsVal::str(to_relation(node.op)),
        "left" => adapt_conditional(node.left),
        "right" => right,
        "position" => node.position,
        "source" => JsVal::Null,
    }
}

pub fn adapt_complex(node: Expression) -> JsVal {
    if let Expression::Value(value) = node {
        return value;
    }
    let position = node.position();
    obj! {
        "type" => JsVal::node_type(NodeTypes::BooleanExpression),
        "condition" => adapt_conditional(node),
        "position" => position,
        "source" => JsVal::Null,
    }
}
