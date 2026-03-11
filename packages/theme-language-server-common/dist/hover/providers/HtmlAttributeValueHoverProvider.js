"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlAttributeValueHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const docset_1 = require("../../docset");
const utils_1 = require("../../utils");
class HtmlAttributeValueHoverProvider {
    async hover(currentNode, ancestors) {
        var _a;
        const attributeNode = (0, utils_1.findLast)(ancestors, utils_1.isHtmlAttribute);
        const tagNode = (0, utils_1.findLast)(ancestors, utils_1.isNamedHtmlElementNode);
        if (!(0, utils_1.isTextNode)(currentNode) ||
            !attributeNode ||
            !tagNode ||
            !(0, utils_1.isHtmlAttribute)(attributeNode) ||
            !(0, utils_1.isNamedHtmlElementNode)(tagNode) ||
            attributeNode.type === liquid_html_parser_1.NodeTypes.AttrEmpty ||
            attributeNode.value.length !== 1 ||
            !attributeNode.value.includes(currentNode)) {
            return null;
        }
        const valueName = currentNode.value;
        const attrName = (0, utils_1.getCompoundName)(attributeNode);
        const tagName = (0, utils_1.getCompoundName)(tagNode);
        const tagEntry = docset_1.HtmlData.tags.find((tag) => tag.name === tagName);
        const attribute = (_a = docset_1.HtmlData.globalAttributes.find((attr) => attr.name === attrName)) !== null && _a !== void 0 ? _a : tagEntry === null || tagEntry === void 0 ? void 0 : tagEntry.attributes.find((attr) => attr.name === attrName);
        const valueSetName = attribute === null || attribute === void 0 ? void 0 : attribute.valueSet;
        const valueSetEntry = docset_1.HtmlData.valueSets.find((valueSet) => valueSet.name === valueSetName);
        const valueEntry = valueSetEntry === null || valueSetEntry === void 0 ? void 0 : valueSetEntry.values.find((value) => value.name === valueName);
        if (!valueEntry) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, docset_1.renderHtmlEntry)(valueEntry, (attribute === null || attribute === void 0 ? void 0 : attribute.references) ? attribute : tagEntry),
            },
        };
    }
}
exports.HtmlAttributeValueHoverProvider = HtmlAttributeValueHoverProvider;
//# sourceMappingURL=HtmlAttributeValueHoverProvider.js.map