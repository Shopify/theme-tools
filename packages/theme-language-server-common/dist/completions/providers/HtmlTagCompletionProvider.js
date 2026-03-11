"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlTagCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const docset_1 = require("../../docset");
const utils_1 = require("../../utils");
const params_1 = require("../params");
const common_1 = require("./common");
class HtmlTagCompletionProvider {
    constructor() { }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        const grandParentNode = ancestors.at(-2);
        if (node && node.type === liquid_html_parser_1.NodeTypes.HtmlVoidElement) {
            const options = docset_1.HtmlData.tags.filter((tag) => tag.name === node.name);
            return options.map(toCompletionItem);
        }
        if (!node || !parentNode || !(0, utils_1.isTextNode)(node) || !canComplete(node, parentNode)) {
            return [];
        }
        const name = node.value;
        const partial = name.replace(params_1.CURSOR, '');
        const options = getOptions(partial, parentNode, grandParentNode);
        return options.sort(common_1.sortByName).map(toCompletionItem);
    }
}
exports.HtmlTagCompletionProvider = HtmlTagCompletionProvider;
function canComplete(node, parentNode) {
    return (isElementOrDanglingClose(parentNode) &&
        parentNode.name.includes(node) &&
        parentNode.name.length === 1);
}
function getOptions(partial, parentNode, grandParentNode) {
    if (parentNode.type === liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose) {
        return grandParentCloseOption(grandParentNode);
    }
    const grandParentName = getGrandParentName(grandParentNode);
    return docset_1.HtmlData.tags
        .filter((tag) => tag.name.startsWith(partial))
        .concat(grandParentName && partial === ''
        ? {
            name: '/' + grandParentName,
            description: '',
            attributes: [],
            references: [],
        }
        : []);
}
function toCompletionItem(tag) {
    return {
        label: tag.name,
        kind: vscode_languageserver_1.CompletionItemKind.Property,
        documentation: {
            kind: 'markdown',
            value: (0, docset_1.renderHtmlEntry)(tag),
        },
    };
}
function grandParentCloseOption(grandParentNode) {
    var _a;
    const grandParentName = getGrandParentName(grandParentNode);
    if (grandParentName) {
        return [
            (_a = docset_1.HtmlData.tags.find((tag) => tag.name === grandParentName)) !== null && _a !== void 0 ? _a : {
                name: grandParentName,
                description: '',
                attributes: [],
                references: [],
            },
        ];
    }
    else {
        return [];
    }
}
function getGrandParentName(grandParentNode) {
    if (grandParentNode &&
        grandParentNode.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
        grandParentNode.name.length === 1 &&
        (0, utils_1.isTextNode)(grandParentNode.name[0])) {
        return grandParentNode.name[0].value.replace(params_1.CURSOR, '');
    }
}
function isElementOrDanglingClose(node) {
    return [liquid_html_parser_1.NodeTypes.HtmlElement, liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose].includes(node.type);
}
//# sourceMappingURL=HtmlTagCompletionProvider.js.map