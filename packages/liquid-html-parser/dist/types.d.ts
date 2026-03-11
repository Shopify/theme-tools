export interface Position {
    /** 0-indexed offset in the string, included */
    start: number;
    /** 0-indexed offset, excluded */
    end: number;
}
export declare enum NodeTypes {
    Document = "Document",
    LiquidRawTag = "LiquidRawTag",
    LiquidTag = "LiquidTag",
    LiquidBranch = "LiquidBranch",
    LiquidVariableOutput = "LiquidVariableOutput",
    HtmlSelfClosingElement = "HtmlSelfClosingElement",
    HtmlVoidElement = "HtmlVoidElement",
    HtmlDoctype = "HtmlDoctype",
    HtmlComment = "HtmlComment",
    HtmlElement = "HtmlElement",
    HtmlDanglingMarkerClose = "HtmlDanglingMarkerClose",
    HtmlRawNode = "HtmlRawNode",
    AttrSingleQuoted = "AttrSingleQuoted",
    AttrDoubleQuoted = "AttrDoubleQuoted",
    AttrUnquoted = "AttrUnquoted",
    AttrEmpty = "AttrEmpty",
    TextNode = "TextNode",
    YAMLFrontmatter = "YAMLFrontmatter",
    LiquidVariable = "LiquidVariable",
    LiquidFilter = "LiquidFilter",
    NamedArgument = "NamedArgument",
    LiquidLiteral = "LiquidLiteral",
    BooleanExpression = "BooleanExpression",
    String = "String",
    Number = "Number",
    Range = "Range",
    VariableLookup = "VariableLookup",
    Comparison = "Comparison",
    LogicalExpression = "LogicalExpression",
    AssignMarkup = "AssignMarkup",
    ContentForMarkup = "ContentForMarkup",
    CycleMarkup = "CycleMarkup",
    ForMarkup = "ForMarkup",
    PaginateMarkup = "PaginateMarkup",
    RawMarkup = "RawMarkup",
    RenderMarkup = "RenderMarkup",
    RenderVariableExpression = "RenderVariableExpression",
    RenderAliasExpression = "RenderAliasExpression",
    LiquidDocDescriptionNode = "LiquidDocDescriptionNode",
    LiquidDocParamNode = "LiquidDocParamNode",
    LiquidDocExampleNode = "LiquidDocExampleNode",
    LiquidDocPromptNode = "LiquidDocPromptNode"
}
export declare enum NamedTags {
    assign = "assign",
    capture = "capture",
    case = "case",
    content_for = "content_for",
    cycle = "cycle",
    decrement = "decrement",
    echo = "echo",
    elsif = "elsif",
    for = "for",
    form = "form",
    if = "if",
    include = "include",
    increment = "increment",
    layout = "layout",
    liquid = "liquid",
    paginate = "paginate",
    render = "render",
    section = "section",
    sections = "sections",
    tablerow = "tablerow",
    unless = "unless",
    when = "when"
}
export declare enum Comparators {
    CONTAINS = "contains",
    EQUAL = "==",
    GREATER_THAN = ">",
    GREATER_THAN_OR_EQUAL = ">=",
    LESS_THAN = "<",
    LESS_THAN_OR_EQUAL = "<=",
    NOT_EQUAL = "!="
}
export declare const HtmlNodeTypes: readonly [NodeTypes.HtmlElement, NodeTypes.HtmlDanglingMarkerClose, NodeTypes.HtmlRawNode, NodeTypes.HtmlVoidElement, NodeTypes.HtmlSelfClosingElement];
export declare const LiquidNodeTypes: readonly [NodeTypes.LiquidTag, NodeTypes.LiquidVariableOutput, NodeTypes.LiquidBranch, NodeTypes.LiquidRawTag];
export declare const LoopNamedTags: readonly [NamedTags.for, NamedTags.tablerow];
export declare const nonTraversableProperties: Set<string>;
