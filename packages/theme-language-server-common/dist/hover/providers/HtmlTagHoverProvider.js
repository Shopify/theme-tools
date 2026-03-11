"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlTagHoverProvider = void 0;
const docset_1 = require("../../docset");
const utils_1 = require("../../utils");
class HtmlTagHoverProvider {
    async hover(currentNode, ancestors) {
        let name;
        const parentNode = ancestors.at(-1);
        if ((0, utils_1.isNamedHtmlElementNode)(currentNode) && typeof currentNode.name === 'string') {
            name = currentNode.name;
        }
        else if ((0, utils_1.isTextNode)(currentNode) &&
            parentNode &&
            (0, utils_1.isNamedHtmlElementNode)(parentNode) &&
            typeof parentNode.name !== 'string' &&
            parentNode.name.includes(currentNode) &&
            parentNode.name.length === 1) {
            name = currentNode.value;
        }
        if (!name) {
            return null;
        }
        const entry = docset_1.HtmlData.tags.find((tag) => tag.name === name);
        if (!entry) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, docset_1.renderHtmlEntry)(entry),
            },
        };
    }
}
exports.HtmlTagHoverProvider = HtmlTagHoverProvider;
//# sourceMappingURL=HtmlTagHoverProvider.js.map