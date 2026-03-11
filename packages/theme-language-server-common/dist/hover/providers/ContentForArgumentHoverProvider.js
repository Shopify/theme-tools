"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentForArgumentHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const liquidDoc_1 = require("../../utils/liquidDoc");
class ContentForArgumentHoverProvider {
    constructor(getDocDefinitionForURI) {
        this.getDocDefinitionForURI = getDocDefinitionForURI;
    }
    async hover(currentNode, ancestors, params) {
        var _a, _b;
        const parentNode = ancestors.at(-1);
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.NamedArgument ||
            !parentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.ContentForMarkup ||
            parentNode.contentForType.type !== liquid_html_parser_1.NodeTypes.String) {
            return null;
        }
        const blockName = (0, theme_check_common_1.getBlockName)(parentNode);
        if (!blockName) {
            return null;
        }
        const docDefinition = await this.getDocDefinitionForURI(params.textDocument.uri, 'blocks', blockName);
        const hoverArgument = (_b = (_a = docDefinition === null || docDefinition === void 0 ? void 0 : docDefinition.liquidDoc) === null || _a === void 0 ? void 0 : _a.parameters) === null || _b === void 0 ? void 0 : _b.find((argument) => argument.name === currentNode.name);
        if (!hoverArgument) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, liquidDoc_1.formatLiquidDocParameter)(hoverArgument, true),
            },
        };
    }
}
exports.ContentForArgumentHoverProvider = ContentForArgumentHoverProvider;
//# sourceMappingURL=ContentForArgumentHoverProvider.js.map