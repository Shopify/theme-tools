"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidBlockTagDocumentHighlightsProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
class LiquidBlockTagDocumentHighlightsProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    async documentHighlights(node, ancestors, params) {
        var _a;
        const textDocument = (_a = this.documentManager.get(params.textDocument.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        if (!textDocument)
            return null;
        if (isLiquidBranch(node)) {
            node = ancestors.at(-1);
        }
        if (!isLiquidBlock(node) || !node.blockEndPosition) {
            return null;
        }
        const nameOffset = node.source.indexOf(node.name, node.blockStartPosition.start);
        const endblockNameOffset = node.source.indexOf('end' + node.name, node.blockEndPosition.start);
        const ranges = [
            vscode_languageserver_1.Range.create(textDocument.positionAt(nameOffset), textDocument.positionAt(nameOffset + node.name.length)),
            vscode_languageserver_1.Range.create(textDocument.positionAt(endblockNameOffset), 
            // "end" is 3 characters, end$name is 3 + node.name.length.
            textDocument.positionAt(endblockNameOffset + 3 + node.name.length)),
        ];
        // highlighting the elsif/else branches as well
        if (isLiquidTag(node) && node.children && node.children.every(isLiquidBranch)) {
            for (const branch of node.children.filter((x) => x.name !== null)) {
                const branchNameOffset = node.source.indexOf(branch.name, branch.blockStartPosition.start);
                ranges.push(vscode_languageserver_1.Range.create(textDocument.positionAt(branchNameOffset), textDocument.positionAt(branchNameOffset + branch.name.length)));
            }
        }
        return ranges.map((range) => ({ range }));
    }
}
exports.LiquidBlockTagDocumentHighlightsProvider = LiquidBlockTagDocumentHighlightsProvider;
function isLiquidBranch(node) {
    return node.type === liquid_html_parser_1.NodeTypes.LiquidBranch;
}
function isLiquidBlock(node) {
    return node.type === liquid_html_parser_1.NodeTypes.LiquidTag || node.type === liquid_html_parser_1.NodeTypes.LiquidRawTag;
}
function isLiquidTag(node) {
    return node.type === liquid_html_parser_1.NodeTypes.LiquidTag;
}
//# sourceMappingURL=LiquidBlockTagDocumentHighlightsProvider.js.map