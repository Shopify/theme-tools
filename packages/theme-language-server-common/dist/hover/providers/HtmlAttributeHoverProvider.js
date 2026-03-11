"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlAttributeHoverProvider = void 0;
const docset_1 = require("../../docset");
const utils_1 = require("../../utils");
class HtmlAttributeHoverProvider {
    async hover(currentNode, ancestors) {
        var _a;
        const attributeNode = ancestors.at(-1);
        const tagNode = (0, utils_1.findLast)(ancestors, utils_1.isNamedHtmlElementNode);
        if (!attributeNode ||
            !tagNode ||
            !(0, utils_1.isTextNode)(currentNode) ||
            !(0, utils_1.isHtmlAttribute)(attributeNode) ||
            !attributeNode.name.includes(currentNode) ||
            attributeNode.name.length > 1 ||
            !(0, utils_1.isNamedHtmlElementNode)(tagNode)) {
            return null;
        }
        const name = currentNode.value;
        const tagName = (0, utils_1.getCompoundName)(tagNode);
        const tagEntry = docset_1.HtmlData.tags.find((tag) => tag.name === tagName);
        const tagEntryAttributes = (tagEntry === null || tagEntry === void 0 ? void 0 : tagEntry.attributes) || [];
        const attribute = (_a = docset_1.HtmlData.globalAttributes.find((attr) => attr.name === name)) !== null && _a !== void 0 ? _a : tagEntryAttributes.find((attr) => attr.name === name);
        if (!attribute) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, docset_1.renderHtmlEntry)(attribute, 'references' in attribute ? undefined : tagEntry),
            },
        };
    }
}
exports.HtmlAttributeHoverProvider = HtmlAttributeHoverProvider;
//# sourceMappingURL=HtmlAttributeHoverProvider.js.map