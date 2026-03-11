"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentForBlockTypeCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
class ContentForBlockTypeCompletionProvider {
    constructor(getThemeBlockNames) {
        this.getThemeBlockNames = getThemeBlockNames;
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { document } = params;
        const doc = document.textDocument;
        const { node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        const grandParentNode = ancestors.at(-2);
        if (!node ||
            !parentNode ||
            !grandParentNode ||
            node.type !== liquid_html_parser_1.NodeTypes.String ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.NamedArgument ||
            parentNode.name !== 'type' ||
            grandParentNode.type !== liquid_html_parser_1.NodeTypes.ContentForMarkup ||
            grandParentNode.contentForType.value !== 'block') {
            return [];
        }
        return (await this.getThemeBlockNames(doc.uri, false)).map((blockName) => ({
            label: blockName,
            kind: vscode_languageserver_1.CompletionItemKind.EnumMember,
            insertText: blockName,
        }));
    }
}
exports.ContentForBlockTypeCompletionProvider = ContentForBlockTypeCompletionProvider;
//# sourceMappingURL=ContentForBlockTypeCompletionProvider.js.map