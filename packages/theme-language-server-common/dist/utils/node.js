"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlAttributeTypes = exports.HtmlElementTypes = void 0;
exports.isTextNode = isTextNode;
exports.isAttrEmpty = isAttrEmpty;
exports.isNamedHtmlElementNode = isNamedHtmlElementNode;
exports.getCompoundName = getCompoundName;
exports.isHtmlAttribute = isHtmlAttribute;
exports.isNamedLiquidTag = isNamedLiquidTag;
exports.isLiquidVariableOutput = isLiquidVariableOutput;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
exports.HtmlElementTypes = [
    liquid_html_parser_1.NodeTypes.HtmlElement,
    liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose,
    liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement,
    liquid_html_parser_1.NodeTypes.HtmlVoidElement,
    liquid_html_parser_1.NodeTypes.HtmlRawNode,
];
exports.HtmlAttributeTypes = [
    liquid_html_parser_1.NodeTypes.AttrUnquoted,
    liquid_html_parser_1.NodeTypes.AttrDoubleQuoted,
    liquid_html_parser_1.NodeTypes.AttrSingleQuoted,
    liquid_html_parser_1.NodeTypes.AttrEmpty,
];
function isTextNode(node) {
    return node.type === liquid_html_parser_1.NodeTypes.TextNode;
}
function isAttrEmpty(node) {
    return node.type === liquid_html_parser_1.NodeTypes.AttrEmpty;
}
function isNamedHtmlElementNode(node) {
    return exports.HtmlElementTypes.includes(node.type);
}
function getCompoundName(node) {
    if (typeof node.name === 'string')
        return node.name;
    const names = node.name;
    if (names.length === 0 || names.length > 1 || !isTextNode(names[0])) {
        return 'unknown';
    }
    return names[0].value;
}
function isHtmlAttribute(node) {
    return exports.HtmlAttributeTypes.some((type) => node.type === type);
}
function isNamedLiquidTag(node, name) {
    return node.type === liquid_html_parser_1.NodeTypes.LiquidTag && node.name === name && typeof node.markup !== 'string';
}
function isLiquidVariableOutput(node) {
    return node.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput && typeof node.markup !== 'string';
}
//# sourceMappingURL=node.js.map