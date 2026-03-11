"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderSnippetParameterHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const liquidDoc_1 = require("../../utils/liquidDoc");
class RenderSnippetParameterHoverProvider {
    constructor(getDocDefinitionForURI) {
        this.getDocDefinitionForURI = getDocDefinitionForURI;
    }
    async hover(currentNode, ancestors, params) {
        var _a, _b;
        const parentNode = ancestors.at(-1);
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.NamedArgument ||
            !parentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.RenderMarkup ||
            parentNode.snippet.type !== liquid_html_parser_1.NodeTypes.String) {
            return null;
        }
        const docDefinition = await this.getDocDefinitionForURI(params.textDocument.uri, 'snippets', parentNode.snippet.value);
        const paramName = currentNode.name;
        const hoveredParameter = (_b = (_a = docDefinition === null || docDefinition === void 0 ? void 0 : docDefinition.liquidDoc) === null || _a === void 0 ? void 0 : _a.parameters) === null || _b === void 0 ? void 0 : _b.find((parameter) => parameter.name === paramName);
        if (!hoveredParameter) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, liquidDoc_1.formatLiquidDocParameter)(hoveredParameter, true),
            },
        };
    }
}
exports.RenderSnippetParameterHoverProvider = RenderSnippetParameterHoverProvider;
//# sourceMappingURL=RenderSnippetParameterHoverProvider.js.map