"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderSnippetCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
class RenderSnippetCompletionProvider {
    constructor(getSnippetNamesForURI = async () => []) {
        this.getSnippetNamesForURI = getSnippetNamesForURI;
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        if (!node ||
            !parentNode ||
            node.type !== liquid_html_parser_1.NodeTypes.String ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.RenderMarkup) {
            return [];
        }
        const options = await this.getSnippetNamesForURI(params.textDocument.uri);
        const partial = node.value;
        return options
            .filter((option) => option.startsWith(partial))
            .map((option) => ({
            label: option,
            kind: vscode_languageserver_1.CompletionItemKind.Snippet,
            documentation: {
                kind: 'markdown',
                value: `snippets/${option}.liquid`,
            },
        }));
    }
}
exports.RenderSnippetCompletionProvider = RenderSnippetCompletionProvider;
//# sourceMappingURL=RenderSnippetCompletionProvider.js.map