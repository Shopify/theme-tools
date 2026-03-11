"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedEditingRangesProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const theme_check_common_2 = require("@shopify/theme-check-common");
const providers_1 = require("./providers");
class LinkedEditingRangesProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
        this.providers = [
            new providers_1.HtmlTagNameLinkedRangesProvider(documentManager),
            new providers_1.EmptyHtmlTagLinkedRangesProvider(documentManager),
        ];
    }
    async linkedEditingRanges(params) {
        var _a;
        const document = this.documentManager.get(params.textDocument.uri);
        if (!document || document.type !== theme_check_common_1.SourceCodeType.LiquidHtml) {
            return null;
        }
        let currentNode = null;
        let ancestors = null;
        if (!(document.ast instanceof Error)) {
            [currentNode, ancestors] = (0, theme_check_common_2.findCurrentNode)(document.ast, document.textDocument.offsetAt(params.position));
        }
        const promises = this.providers.map((p) => p.linkedEditingRanges(currentNode, ancestors, params).catch(() => null));
        const results = await Promise.all(promises);
        return (_a = results.find(Boolean)) !== null && _a !== void 0 ? _a : null;
    }
}
exports.LinkedEditingRangesProvider = LinkedEditingRangesProvider;
//# sourceMappingURL=LinkedEditingRangesProvider.js.map