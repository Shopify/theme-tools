"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlTagNameLinkedRangesProvider = void 0;
const htmlTagNames_1 = require("../../utils/htmlTagNames");
const wordPattern_1 = require("../wordPattern");
class HtmlTagNameLinkedRangesProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    async linkedEditingRanges(node, ancestors, params) {
        var _a;
        if (!node || !ancestors)
            return null;
        const textDocument = (_a = this.documentManager.get(params.textDocument.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        if (!textDocument)
            return null;
        const ranges = (0, htmlTagNames_1.getHtmlElementNameRanges)(node, ancestors, params, textDocument);
        if (!ranges)
            return null;
        return {
            ranges,
            wordPattern: wordPattern_1.htmlElementNameWordPattern,
        };
    }
}
exports.HtmlTagNameLinkedRangesProvider = HtmlTagNameLinkedRangesProvider;
//# sourceMappingURL=HtmlTagNameLinkedRangesProvider.js.map