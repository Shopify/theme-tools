//! Port of `NodeTypes` and `Comparators` from `src/types.ts`.
//!
//! Only the variants the markup parser and tags emit. 5c adds the rest.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NodeTypes {
    LiquidVariable,
    LiquidFilter,
    NamedArgument,
    LiquidLiteral,
    BooleanExpression,
    String,
    Number,
    Range,
    VariableLookup,
    Comparison,
    LogicalExpression,
    AssignMarkup,
    BlockMarkup,
    ContentForMarkup,
    CycleMarkup,
    ForMarkup,
    PaginateMarkup,
    RenderMarkup,
    SectionMarkup,
    RenderVariableExpression,
    RenderAliasExpression,
}

impl NodeTypes {
    pub fn as_str(self) -> &'static str {
        match self {
            NodeTypes::LiquidVariable => "LiquidVariable",
            NodeTypes::LiquidFilter => "LiquidFilter",
            NodeTypes::NamedArgument => "NamedArgument",
            NodeTypes::LiquidLiteral => "LiquidLiteral",
            NodeTypes::BooleanExpression => "BooleanExpression",
            NodeTypes::String => "String",
            NodeTypes::Number => "Number",
            NodeTypes::Range => "Range",
            NodeTypes::VariableLookup => "VariableLookup",
            NodeTypes::Comparison => "Comparison",
            NodeTypes::LogicalExpression => "LogicalExpression",
            NodeTypes::AssignMarkup => "AssignMarkup",
            NodeTypes::BlockMarkup => "BlockMarkup",
            NodeTypes::ContentForMarkup => "ContentForMarkup",
            NodeTypes::CycleMarkup => "CycleMarkup",
            NodeTypes::ForMarkup => "ForMarkup",
            NodeTypes::PaginateMarkup => "PaginateMarkup",
            NodeTypes::RenderMarkup => "RenderMarkup",
            NodeTypes::SectionMarkup => "SectionMarkup",
            NodeTypes::RenderVariableExpression => "RenderVariableExpression",
            NodeTypes::RenderAliasExpression => "RenderAliasExpression",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Comparators {
    Contains,
    Equal,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    NotEqual,
}

impl Comparators {
    pub fn as_str(self) -> &'static str {
        match self {
            Comparators::Contains => "contains",
            Comparators::Equal => "==",
            Comparators::GreaterThan => ">",
            Comparators::GreaterThanOrEqual => ">=",
            Comparators::LessThan => "<",
            Comparators::LessThanOrEqual => "<=",
            Comparators::NotEqual => "!=",
        }
    }
}
