"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nonTraversableProperties = exports.LoopNamedTags = exports.LiquidNodeTypes = exports.HtmlNodeTypes = exports.Comparators = exports.NamedTags = exports.NodeTypes = void 0;
var NodeTypes;
(function (NodeTypes) {
    NodeTypes["Document"] = "Document";
    NodeTypes["LiquidRawTag"] = "LiquidRawTag";
    NodeTypes["LiquidTag"] = "LiquidTag";
    NodeTypes["LiquidBranch"] = "LiquidBranch";
    NodeTypes["LiquidVariableOutput"] = "LiquidVariableOutput";
    NodeTypes["HtmlSelfClosingElement"] = "HtmlSelfClosingElement";
    NodeTypes["HtmlVoidElement"] = "HtmlVoidElement";
    NodeTypes["HtmlDoctype"] = "HtmlDoctype";
    NodeTypes["HtmlComment"] = "HtmlComment";
    NodeTypes["HtmlElement"] = "HtmlElement";
    NodeTypes["HtmlDanglingMarkerClose"] = "HtmlDanglingMarkerClose";
    NodeTypes["HtmlRawNode"] = "HtmlRawNode";
    NodeTypes["AttrSingleQuoted"] = "AttrSingleQuoted";
    NodeTypes["AttrDoubleQuoted"] = "AttrDoubleQuoted";
    NodeTypes["AttrUnquoted"] = "AttrUnquoted";
    NodeTypes["AttrEmpty"] = "AttrEmpty";
    NodeTypes["TextNode"] = "TextNode";
    NodeTypes["YAMLFrontmatter"] = "YAMLFrontmatter";
    NodeTypes["LiquidVariable"] = "LiquidVariable";
    NodeTypes["LiquidFilter"] = "LiquidFilter";
    NodeTypes["NamedArgument"] = "NamedArgument";
    NodeTypes["LiquidLiteral"] = "LiquidLiteral";
    NodeTypes["BooleanExpression"] = "BooleanExpression";
    NodeTypes["String"] = "String";
    NodeTypes["Number"] = "Number";
    NodeTypes["Range"] = "Range";
    NodeTypes["VariableLookup"] = "VariableLookup";
    NodeTypes["Comparison"] = "Comparison";
    NodeTypes["LogicalExpression"] = "LogicalExpression";
    NodeTypes["AssignMarkup"] = "AssignMarkup";
    NodeTypes["ContentForMarkup"] = "ContentForMarkup";
    NodeTypes["CycleMarkup"] = "CycleMarkup";
    NodeTypes["ForMarkup"] = "ForMarkup";
    NodeTypes["PaginateMarkup"] = "PaginateMarkup";
    NodeTypes["RawMarkup"] = "RawMarkup";
    NodeTypes["RenderMarkup"] = "RenderMarkup";
    NodeTypes["RenderVariableExpression"] = "RenderVariableExpression";
    NodeTypes["RenderAliasExpression"] = "RenderAliasExpression";
    NodeTypes["LiquidDocDescriptionNode"] = "LiquidDocDescriptionNode";
    NodeTypes["LiquidDocParamNode"] = "LiquidDocParamNode";
    NodeTypes["LiquidDocExampleNode"] = "LiquidDocExampleNode";
    NodeTypes["LiquidDocPromptNode"] = "LiquidDocPromptNode";
})(NodeTypes || (exports.NodeTypes = NodeTypes = {}));
// These are officially supported with special node types
var NamedTags;
(function (NamedTags) {
    NamedTags["assign"] = "assign";
    NamedTags["capture"] = "capture";
    NamedTags["case"] = "case";
    NamedTags["content_for"] = "content_for";
    NamedTags["cycle"] = "cycle";
    NamedTags["decrement"] = "decrement";
    NamedTags["echo"] = "echo";
    NamedTags["elsif"] = "elsif";
    NamedTags["for"] = "for";
    NamedTags["form"] = "form";
    NamedTags["if"] = "if";
    NamedTags["include"] = "include";
    NamedTags["increment"] = "increment";
    NamedTags["layout"] = "layout";
    NamedTags["liquid"] = "liquid";
    NamedTags["paginate"] = "paginate";
    NamedTags["render"] = "render";
    NamedTags["section"] = "section";
    NamedTags["sections"] = "sections";
    NamedTags["tablerow"] = "tablerow";
    NamedTags["unless"] = "unless";
    NamedTags["when"] = "when";
})(NamedTags || (exports.NamedTags = NamedTags = {}));
var Comparators;
(function (Comparators) {
    Comparators["CONTAINS"] = "contains";
    Comparators["EQUAL"] = "==";
    Comparators["GREATER_THAN"] = ">";
    Comparators["GREATER_THAN_OR_EQUAL"] = ">=";
    Comparators["LESS_THAN"] = "<";
    Comparators["LESS_THAN_OR_EQUAL"] = "<=";
    Comparators["NOT_EQUAL"] = "!=";
})(Comparators || (exports.Comparators = Comparators = {}));
exports.HtmlNodeTypes = [
    NodeTypes.HtmlElement,
    NodeTypes.HtmlDanglingMarkerClose,
    NodeTypes.HtmlRawNode,
    NodeTypes.HtmlVoidElement,
    NodeTypes.HtmlSelfClosingElement,
];
exports.LiquidNodeTypes = [
    NodeTypes.LiquidTag,
    NodeTypes.LiquidVariableOutput,
    NodeTypes.LiquidBranch,
    NodeTypes.LiquidRawTag,
];
exports.LoopNamedTags = [NamedTags.for, NamedTags.tablerow];
// Those properties create loops that would make walking infinite
exports.nonTraversableProperties = new Set([
    'parentNode',
    'prev',
    'next',
    'firstChild',
    'lastChild',
]);
//# sourceMappingURL=types.js.map