"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidFilterHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const docset_1 = require("../../docset");
class LiquidFilterHoverProvider {
    constructor(themeDocset) {
        this.themeDocset = themeDocset;
    }
    async hover(currentNode) {
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.LiquidFilter) {
            return null;
        }
        const name = currentNode.name;
        const entries = await this.themeDocset.filters();
        const entry = entries.find((entry) => entry.name === name);
        if (!entry) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, docset_1.render)(entry, undefined, 'filter'),
            },
        };
    }
}
exports.LiquidFilterHoverProvider = LiquidFilterHoverProvider;
//# sourceMappingURL=LiquidFilterHoverProvider.js.map