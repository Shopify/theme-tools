"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHtmlElementNameRanges = getHtmlElementNameRanges;
exports.isDanglingOpenHtmlElement = isDanglingOpenHtmlElement;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const isCovered_1 = require("./isCovered");
function getHtmlElementNameRanges(node, ancestors, params, textDocument) {
    let htmlElementNode = null;
    // Try parent node as HTML Element
    // <name> case
    const parentNode = ancestors.at(-1);
    if (parentNode &&
        parentNode.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
        parentNode.name.length > 0 &&
        (0, isCovered_1.isCovered)(textDocument.offsetAt(params.position), {
            start: parentNode.name[0].position.start,
            end: parentNode.name.at(-1).position.end,
        })) {
        htmlElementNode = parentNode;
    }
    // </name> case
    if (node.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
        node.name.length > 0 &&
        (0, isCovered_1.isCovered)(textDocument.offsetAt(params.position), node.blockEndPosition)) {
        htmlElementNode = node;
    }
    if (!htmlElementNode || isDanglingOpenHtmlElement(htmlElementNode))
        return null;
    const nameNodes = htmlElementNode.name;
    const firstNode = nameNodes.at(0);
    const lastNode = nameNodes.at(-1);
    const startRange = vscode_languageserver_1.Range.create(textDocument.positionAt(firstNode.position.start), textDocument.positionAt(lastNode.position.end));
    const endRange = vscode_languageserver_1.Range.create(
    // </ means offset 2 characters
    textDocument.positionAt(htmlElementNode.blockEndPosition.start + 2), textDocument.positionAt(htmlElementNode.blockEndPosition.end - 1));
    return [startRange, endRange];
}
function isDanglingOpenHtmlElement(node) {
    return (node.type === liquid_html_parser_1.NodeTypes.HtmlElement && node.blockEndPosition.start === node.blockEndPosition.end);
}
//# sourceMappingURL=htmlTagNames.js.map