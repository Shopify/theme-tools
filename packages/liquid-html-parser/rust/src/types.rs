//! Port of `NodeTypes` and `Comparators` from `src/types.ts`.
//!
//! Only the variants the parser emits. `LiquidErrorNode` comes with the
//! tolerant parser in 5d.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NodeTypes {
    Document,
    LiquidRawTag,
    LiquidTag,
    LiquidBranch,
    LiquidVariableOutput,
    HtmlSelfClosingElement,
    HtmlVoidElement,
    HtmlDoctype,
    HtmlComment,
    HtmlElement,
    HtmlDanglingMarkerClose,
    HtmlRawNode,
    AttrSingleQuoted,
    AttrDoubleQuoted,
    AttrUnquoted,
    AttrEmpty,
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
    RawMarkup,
    RenderMarkup,
    SectionMarkup,
    RenderVariableExpression,
    RenderAliasExpression,
    TextNode,
    YAMLFrontmatter,
    LiquidDocDescriptionNode,
    LiquidDocParamNode,
    LiquidDocExampleNode,
    LiquidDocPromptNode,
}

impl NodeTypes {
    pub fn as_str(self) -> &'static str {
        match self {
            NodeTypes::Document => "Document",
            NodeTypes::LiquidRawTag => "LiquidRawTag",
            NodeTypes::LiquidTag => "LiquidTag",
            NodeTypes::LiquidBranch => "LiquidBranch",
            NodeTypes::LiquidVariableOutput => "LiquidVariableOutput",
            NodeTypes::HtmlSelfClosingElement => "HtmlSelfClosingElement",
            NodeTypes::HtmlVoidElement => "HtmlVoidElement",
            NodeTypes::HtmlDoctype => "HtmlDoctype",
            NodeTypes::HtmlComment => "HtmlComment",
            NodeTypes::HtmlElement => "HtmlElement",
            NodeTypes::HtmlDanglingMarkerClose => "HtmlDanglingMarkerClose",
            NodeTypes::HtmlRawNode => "HtmlRawNode",
            NodeTypes::AttrSingleQuoted => "AttrSingleQuoted",
            NodeTypes::AttrDoubleQuoted => "AttrDoubleQuoted",
            NodeTypes::AttrUnquoted => "AttrUnquoted",
            NodeTypes::AttrEmpty => "AttrEmpty",
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
            NodeTypes::RawMarkup => "RawMarkup",
            NodeTypes::RenderMarkup => "RenderMarkup",
            NodeTypes::SectionMarkup => "SectionMarkup",
            NodeTypes::RenderVariableExpression => "RenderVariableExpression",
            NodeTypes::RenderAliasExpression => "RenderAliasExpression",
            NodeTypes::TextNode => "TextNode",
            NodeTypes::YAMLFrontmatter => "YAMLFrontmatter",
            NodeTypes::LiquidDocDescriptionNode => "LiquidDocDescriptionNode",
            NodeTypes::LiquidDocParamNode => "LiquidDocParamNode",
            NodeTypes::LiquidDocExampleNode => "LiquidDocExampleNode",
            NodeTypes::LiquidDocPromptNode => "LiquidDocPromptNode",
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
