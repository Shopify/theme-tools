"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderSnippetHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const liquidDoc_1 = require("../../utils/liquidDoc");
class RenderSnippetHoverProvider {
    constructor(getDocDefinitionForURI) {
        this.getDocDefinitionForURI = getDocDefinitionForURI;
    }
    async hover(currentNode, ancestors, params) {
        const parentNode = ancestors.at(-1);
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.String ||
            !parentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.RenderMarkup) {
            return null;
        }
        const snippetName = currentNode.value;
        const docDefinition = await this.getDocDefinitionForURI(params.textDocument.uri, 'snippets', snippetName);
        return {
            contents: {
                kind: 'markdown',
                value: (0, liquidDoc_1.formatLiquidDocContentMarkdown)(snippetName, docDefinition),
            },
        };
    }
}
exports.RenderSnippetHoverProvider = RenderSnippetHoverProvider;
//# sourceMappingURL=RenderSnippetHoverProvider.js.map