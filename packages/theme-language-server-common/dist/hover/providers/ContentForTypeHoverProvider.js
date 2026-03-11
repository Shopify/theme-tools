"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentForTypeHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const liquidDoc_1 = require("../../utils/liquidDoc");
class ContentForTypeHoverProvider {
    constructor(getDocDefinitionForURI) {
        this.getDocDefinitionForURI = getDocDefinitionForURI;
    }
    async hover(currentNode, ancestors, params) {
        const parentNode = ancestors.at(-1);
        const grandParentNode = ancestors.at(-2);
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.String ||
            !parentNode ||
            !grandParentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.NamedArgument ||
            parentNode.name !== 'type' ||
            grandParentNode.type !== liquid_html_parser_1.NodeTypes.ContentForMarkup) {
            return null;
        }
        const blockName = currentNode.value;
        const docDefinition = await this.getDocDefinitionForURI(params.textDocument.uri, 'blocks', blockName);
        return {
            contents: {
                kind: 'markdown',
                value: (0, liquidDoc_1.formatLiquidDocContentMarkdown)(blockName, docDefinition),
            },
        };
    }
}
exports.ContentForTypeHoverProvider = ContentForTypeHoverProvider;
//# sourceMappingURL=ContentForTypeHoverProvider.js.map