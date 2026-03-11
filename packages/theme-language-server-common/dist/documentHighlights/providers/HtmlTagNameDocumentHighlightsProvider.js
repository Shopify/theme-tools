"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlTagNameDocumentHighlightsProvider = void 0;
const htmlTagNames_1 = require("../../utils/htmlTagNames");
class HtmlTagNameDocumentHighlightsProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    async documentHighlights(node, ancestors, params) {
        var _a;
        const textDocument = (_a = this.documentManager.get(params.textDocument.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        if (!textDocument)
            return null;
        const ranges = (0, htmlTagNames_1.getHtmlElementNameRanges)(node, ancestors, params, textDocument);
        if (!ranges)
            return null;
        return ranges.map((range) => ({ range }));
    }
}
exports.HtmlTagNameDocumentHighlightsProvider = HtmlTagNameDocumentHighlightsProvider;
//# sourceMappingURL=HtmlTagNameDocumentHighlightsProvider.js.map