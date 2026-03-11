"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidDocTagCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const liquidDoc_1 = require("../../utils/liquidDoc");
const theme_check_common_1 = require("@shopify/theme-check-common");
class LiquidDocTagCompletionProvider {
    constructor() { }
    async completions(params) {
        var _a;
        if (!params.completionContext)
            return [];
        if (!(0, theme_check_common_1.filePathSupportsLiquidDoc)(params.document.uri))
            return [];
        const { node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        if (!node ||
            !parentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.LiquidRawTag ||
            parentNode.name !== 'doc') {
            return [];
        }
        switch (node.type) {
            case liquid_html_parser_1.NodeTypes.TextNode:
                if (!node.value.startsWith('@')) {
                    return [];
                }
                return this.createCompletionItems(node.value);
            case liquid_html_parser_1.NodeTypes.LiquidDocDescriptionNode:
            case liquid_html_parser_1.NodeTypes.LiquidDocExampleNode:
            case liquid_html_parser_1.NodeTypes.LiquidDocPromptNode:
                // These nodes accept free-form text, so we only suggest completions if the last line starts with '@'
                const lastLine = (_a = node.content.value.split('\n').at(-1)) === null || _a === void 0 ? void 0 : _a.trim();
                if (!(lastLine === null || lastLine === void 0 ? void 0 : lastLine.startsWith('@'))) {
                    return [];
                }
                return this.createCompletionItems(lastLine);
            default:
                return [];
        }
    }
    createCompletionItems(userInput) {
        // Need to offset the '@' symbol by 1
        const offsetInput = userInput.slice(1);
        const entries = Object.entries(liquidDoc_1.SUPPORTED_LIQUID_DOC_TAG_HANDLES).filter(([label]) => !offsetInput || label.startsWith(offsetInput));
        return entries.map(([label, { description, example, template }]) => {
            const item = {
                label,
                kind: vscode_languageserver_1.CompletionItemKind.EnumMember,
                documentation: {
                    kind: vscode_languageserver_1.MarkupKind.Markdown,
                    value: (0, liquidDoc_1.formatLiquidDocTagHandle)(label, description, example),
                },
                insertText: template,
                insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet,
            };
            return item;
        });
    }
}
exports.LiquidDocTagCompletionProvider = LiquidDocTagCompletionProvider;
//# sourceMappingURL=LiquidDocTagCompletionProvider.js.map