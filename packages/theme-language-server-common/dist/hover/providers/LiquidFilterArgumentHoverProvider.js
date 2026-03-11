"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidFilterArgumentHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const docset_1 = require("../../docset");
class LiquidFilterArgumentHoverProvider {
    constructor(themeDocset) {
        this.themeDocset = themeDocset;
    }
    async hover(currentNode, ancestors) {
        var _a;
        const parentNode = ancestors.at(-1);
        if (!parentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.LiquidFilter ||
            currentNode.type !== liquid_html_parser_1.NodeTypes.NamedArgument) {
            return null;
        }
        const parentName = parentNode.name;
        const entries = await this.themeDocset.filters();
        const entry = entries.find((entry) => entry.name === parentName);
        if (!entry) {
            return null;
        }
        const argument = (_a = entry.parameters) === null || _a === void 0 ? void 0 : _a.find((argument) => argument.name === currentNode.name);
        if (!argument) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, docset_1.render)(argument, undefined, 'filter'),
            },
        };
    }
}
exports.LiquidFilterArgumentHoverProvider = LiquidFilterArgumentHoverProvider;
//# sourceMappingURL=LiquidFilterArgumentHoverProvider.js.map