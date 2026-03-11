"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidDocTagHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const liquidDoc_1 = require("../../utils/liquidDoc");
class LiquidDocTagHoverProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    async hover(currentNode, ancestors, params) {
        var _a;
        const parentNode = ancestors.at(-1);
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.LiquidDocParamNode &&
            currentNode.type !== liquid_html_parser_1.NodeTypes.LiquidDocDescriptionNode &&
            currentNode.type !== liquid_html_parser_1.NodeTypes.LiquidDocExampleNode) {
            return null;
        }
        const document = (_a = this.documentManager.get(params.textDocument.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        // We only want to provide hover when we are on the exact tag name
        // If the cursor is passed that but still within the tag node, we ignore it
        //
        // E.g.
        // Provide hover: @para█m name - description
        // Don't provide hover: @param █name - description
        if (document &&
            document.offsetAt(params.position) > currentNode.position.start + currentNode.name.length) {
            return null;
        }
        const docTagData = liquidDoc_1.SUPPORTED_LIQUID_DOC_TAG_HANDLES[currentNode.name];
        if (!docTagData) {
            return null;
        }
        return {
            contents: {
                kind: vscode_languageserver_1.MarkupKind.Markdown,
                value: (0, liquidDoc_1.formatLiquidDocTagHandle)(currentNode.name, docTagData.description, docTagData.example),
            },
        };
    }
}
exports.LiquidDocTagHoverProvider = LiquidDocTagHoverProvider;
//# sourceMappingURL=LiquidDocTagHoverProvider.js.map