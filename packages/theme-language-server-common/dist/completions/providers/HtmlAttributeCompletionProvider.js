"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlAttributeCompletionProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const docset_1 = require("../../docset");
const utils_1 = require("../../utils");
const params_1 = require("../params");
const common_1 = require("./common");
class HtmlAttributeCompletionProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { node, ancestors } = params.completionContext;
        const parentNode = (0, utils_1.findLast)(ancestors, utils_1.isAttrEmpty);
        const grandParentNode = (0, utils_1.findLast)(ancestors, utils_1.isNamedHtmlElementNode);
        const document = this.documentManager.get(params.textDocument.uri);
        if (!node || !parentNode || !grandParentNode || !document) {
            return [];
        }
        if (!(0, utils_1.isTextNode)(node) || !(0, utils_1.isAttrEmpty)(parentNode) || !(0, utils_1.isNamedHtmlElementNode)(grandParentNode)) {
            return [];
        }
        const grandParentNodeName = (0, utils_1.getCompoundName)(grandParentNode);
        const name = node.value;
        const partial = name.replace(params_1.CURSOR, '');
        const options = getOptions(partial, grandParentNodeName);
        const attributeTagRange = this.attributeTagRange(node, document);
        const hasExistingAttributeValue = this.hasExistingAttributeValue(attributeTagRange, document);
        const hasLiquidTag = this.hasLiquidTag(attributeTagRange, document);
        return options.sort(common_1.sortByName).map((tag) => {
            return toCompletionItem(tag, attributeTagRange, hasExistingAttributeValue, hasLiquidTag);
        });
    }
    hasExistingAttributeValue(attributeTagRange, document) {
        return /^\s*=/.test(document.source.slice(document.textDocument.offsetAt(attributeTagRange.end)));
    }
    hasLiquidTag(attributeTagRange, document) {
        return /^(?:\{%|\{\{)/.test(document.source.slice(document.textDocument.offsetAt(attributeTagRange.end)));
    }
    // Find the range of the attribute partial. If the attribute contains any liquid code, the range
    // will end before the first character of the liquid block.
    attributeTagRange(node, document) {
        var _a, _b;
        if (node.type === 'TextNode' && node.value === params_1.CURSOR) {
            // If you try to auto-complete with no provided attribute tag,
            // we will not try to override the subsequent character.
            // E.g. <a href="" █>
            return {
                start: document.textDocument.positionAt(node.position.start),
                end: document.textDocument.positionAt(node.position.start),
            };
        }
        const sourcePartialPastCursor = document.source.slice(node.position.end);
        const attributeEndOffset = (_b = (_a = sourcePartialPastCursor.match(/[\s=]|\{%|\{\{|>/)) === null || _a === void 0 ? void 0 : _a.index) !== null && _b !== void 0 ? _b : sourcePartialPastCursor.length;
        return {
            start: document.textDocument.positionAt(node.position.start),
            end: document.textDocument.positionAt(node.position.end + attributeEndOffset),
        };
    }
}
exports.HtmlAttributeCompletionProvider = HtmlAttributeCompletionProvider;
function getOptions(partial, parentNodeName) {
    var _a;
    const tag = docset_1.HtmlData.tags.find((tag) => tag.name === parentNodeName);
    const parentAttributes = (_a = tag === null || tag === void 0 ? void 0 : tag.attributes) !== null && _a !== void 0 ? _a : [];
    return [...parentAttributes, ...docset_1.HtmlData.globalAttributes].filter((x) => x.name.startsWith(partial));
}
function toCompletionItem(tag, attributeTagRange, hasExistingAttributeValue, hasLiquidTag) {
    const attributeWithValue = !tag.valueSet || tag.valueSet !== 'v';
    const insertSnippet = attributeWithValue && !hasExistingAttributeValue && !hasLiquidTag;
    return {
        label: tag.name,
        kind: vscode_languageserver_1.CompletionItemKind.Value,
        insertTextFormat: insertSnippet ? vscode_languageserver_1.InsertTextFormat.Snippet : vscode_languageserver_1.InsertTextFormat.PlainText,
        textEdit: vscode_languageserver_1.TextEdit.replace(attributeTagRange, insertSnippet ? `${tag.name}="$1"$0` : tag.name),
        documentation: {
            kind: 'markdown',
            value: (0, docset_1.renderHtmlEntry)(tag),
        },
    };
}
//# sourceMappingURL=HtmlAttributeCompletionProvider.js.map