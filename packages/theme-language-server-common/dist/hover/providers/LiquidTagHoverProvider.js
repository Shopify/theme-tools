"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidTagHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const docset_1 = require("../../docset");
class LiquidTagHoverProvider {
    constructor(themeDocset) {
        this.themeDocset = themeDocset;
    }
    async hover(currentNode) {
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.LiquidTag &&
            currentNode.type !== liquid_html_parser_1.NodeTypes.LiquidRawTag &&
            currentNode.type !== liquid_html_parser_1.NodeTypes.LiquidBranch) {
            return null;
        }
        const name = currentNode.name;
        const entries = await this.themeDocset.tags();
        const entry = entries.find((entry) => entry.name === name);
        if (!entry) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, docset_1.render)(entry, undefined, 'tag'),
            },
        };
    }
}
exports.LiquidTagHoverProvider = LiquidTagHoverProvider;
//# sourceMappingURL=LiquidTagHoverProvider.js.map