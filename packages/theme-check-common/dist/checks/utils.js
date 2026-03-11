"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNodeOfType = isNodeOfType;
exports.isLiquidBranch = isLiquidBranch;
exports.isHtmlTag = isHtmlTag;
exports.isAttr = isAttr;
exports.isHtmlAttribute = isHtmlAttribute;
exports.isValuedHtmlAttribute = isValuedHtmlAttribute;
exports.valueIncludes = valueIncludes;
exports.hasAttributeValueOf = hasAttributeValueOf;
exports.isLiquidString = isLiquidString;
exports.isLoopScopedVariable = isLoopScopedVariable;
exports.isLoopLiquidTag = isLoopLiquidTag;
exports.isWithinRawTagThatDoesNotParseItsContents = isWithinRawTagThatDoesNotParseItsContents;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
function isNodeOfType(type, node) {
    return (node === null || node === void 0 ? void 0 : node.type) === type;
}
function isLiquidBranch(node) {
    return isNodeOfType(liquid_html_parser_1.NodeTypes.LiquidBranch, node);
}
function isHtmlTag(node, name) {
    return (node.name.length === 1 &&
        node.name[0].type === liquid_html_parser_1.NodeTypes.TextNode &&
        node.name[0].value === name &&
        !!node.blockEndPosition);
}
function isAttr(attr, name) {
    return (attr.name.length === 1 &&
        isNodeOfType(liquid_html_parser_1.NodeTypes.TextNode, attr.name[0]) &&
        attr.name[0].value === name);
}
function isHtmlAttribute(attr) {
    return [
        liquid_html_parser_1.NodeTypes.AttrUnquoted,
        liquid_html_parser_1.NodeTypes.AttrDoubleQuoted,
        liquid_html_parser_1.NodeTypes.AttrSingleQuoted,
        liquid_html_parser_1.NodeTypes.AttrEmpty,
    ].some((type) => isNodeOfType(type, attr));
}
function isValuedHtmlAttribute(attr) {
    return [liquid_html_parser_1.NodeTypes.AttrUnquoted, liquid_html_parser_1.NodeTypes.AttrDoubleQuoted, liquid_html_parser_1.NodeTypes.AttrSingleQuoted].some((type) => isNodeOfType(type, attr));
}
function valueIncludes(attr, word) {
    const regex = new RegExp(`(^|\\s)${word}(\\s|$)`, 'g');
    return attr.value
        .filter((node) => isNodeOfType(liquid_html_parser_1.NodeTypes.TextNode, node))
        .some((valueNode) => regex.test(valueNode.value));
}
function hasAttributeValueOf(attr, value) {
    return (attr.value.length === 1 &&
        isNodeOfType(liquid_html_parser_1.NodeTypes.TextNode, attr.value[0]) &&
        attr.value[0].value === value);
}
function isLiquidString(node) {
    return node.type === liquid_html_parser_1.NodeTypes.String;
}
function isLoopScopedVariable(variableName, ancestors) {
    return ancestors.some((ancestor) => ancestor.type === liquid_html_parser_1.NodeTypes.LiquidTag &&
        isLoopLiquidTag(ancestor) &&
        typeof ancestor.markup !== 'string' &&
        ancestor.markup.variableName === variableName);
}
function isLoopLiquidTag(tag) {
    return liquid_html_parser_1.LoopNamedTags.includes(tag.name);
}
const RawTagsThatDoNotParseTheirContents = ['raw', 'stylesheet', 'javascript', 'schema'];
function isRawTagThatDoesNotParseItsContent(node) {
    return (node.type === liquid_html_parser_1.NodeTypes.LiquidRawTag && RawTagsThatDoNotParseTheirContents.includes(node.name));
}
function isWithinRawTagThatDoesNotParseItsContents(ancestors) {
    return ancestors.some(isRawTagThatDoesNotParseItsContent);
}
//# sourceMappingURL=utils.js.map