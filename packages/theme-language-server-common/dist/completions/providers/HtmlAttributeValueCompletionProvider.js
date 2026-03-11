"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlAttributeValueCompletionProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const docset_1 = require("../../docset");
const utils_1 = require("../../utils");
const params_1 = require("../params");
const common_1 = require("./common");
class HtmlAttributeValueCompletionProvider {
    constructor() { }
    async completions(params) {
        var _a, _b;
        if (!params.completionContext)
            return [];
        const { node, ancestors } = params.completionContext;
        const attributeNode = (0, utils_1.findLast)(ancestors, utils_1.isHtmlAttribute);
        const tagNode = (0, utils_1.findLast)(ancestors, utils_1.isNamedHtmlElementNode);
        if (!node ||
            !attributeNode ||
            !tagNode ||
            !(0, utils_1.isTextNode)(node) ||
            !(0, utils_1.isHtmlAttribute)(attributeNode) ||
            !(0, utils_1.isNamedHtmlElementNode)(tagNode) ||
            (0, utils_1.isAttrEmpty)(attributeNode) ||
            !attributeNode.value.includes(node)) {
            return [];
        }
        const tagName = (0, utils_1.getCompoundName)(tagNode);
        const attrName = (0, utils_1.getCompoundName)(attributeNode);
        const name = node.value;
        const partial = name.replace(params_1.CURSOR, '');
        const tagEntry = docset_1.HtmlData.tags.find((tag) => tag.name === tagName);
        const attribute = (_a = docset_1.HtmlData.globalAttributes.find((attr) => attr.name === attrName)) !== null && _a !== void 0 ? _a : tagEntry === null || tagEntry === void 0 ? void 0 : tagEntry.attributes.find((attr) => attr.name === attrName);
        const valueSetName = attribute === null || attribute === void 0 ? void 0 : attribute.valueSet;
        const valueSetEntry = docset_1.HtmlData.valueSets.find((valueSet) => valueSet.name === valueSetName);
        const options = ((_b = valueSetEntry === null || valueSetEntry === void 0 ? void 0 : valueSetEntry.values) !== null && _b !== void 0 ? _b : []).filter((value) => value.name.startsWith(partial));
        return options
            .sort(common_1.sortByName)
            .map((option) => toCompletionItem(option, attribute && 'references' in attribute ? attribute : tagEntry));
    }
}
exports.HtmlAttributeValueCompletionProvider = HtmlAttributeValueCompletionProvider;
function toCompletionItem(value, parentEntry) {
    return {
        label: value.name,
        kind: vscode_languageserver_1.CompletionItemKind.Value,
        documentation: {
            kind: 'markdown',
            value: (0, docset_1.renderHtmlEntry)(value, parentEntry),
        },
    };
}
//# sourceMappingURL=HtmlAttributeValueCompletionProvider.js.map