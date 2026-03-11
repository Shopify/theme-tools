"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentHighlightsProvider = exports.PREVENT_DEFAULT = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const theme_check_common_2 = require("@shopify/theme-check-common");
const providers_1 = require("./providers");
/**
 * The default behaviour for documentHighlights is to highlight every occurence
 * of the word under the cursor. We want to prevent that since it doesn't really
 * make sense in our context. We don't want to highlight every occurence of
 * `assign` when you put your cursor over it.
 */
exports.PREVENT_DEFAULT = [];
/**
 * Informs the client to highlight ranges in a document.
 *
 * This is a pretty abstract concept, but you could use it to highlight all
 * instances of a variable in a template, to highlight the matching
 * opening/closing liquid tags, html tags, etc.
 */
class DocumentHighlightsProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
        this.providers = [
            new providers_1.HtmlTagNameDocumentHighlightsProvider(documentManager),
            new providers_1.LiquidBlockTagDocumentHighlightsProvider(documentManager),
        ];
    }
    async documentHighlights(params) {
        var _a;
        const document = this.documentManager.get(params.textDocument.uri);
        if (!document || document.type !== theme_check_common_1.SourceCodeType.LiquidHtml || document.ast instanceof Error) {
            return exports.PREVENT_DEFAULT;
        }
        const [currentNode, ancestors] = (0, theme_check_common_2.findCurrentNode)(document.ast, document.textDocument.offsetAt(params.position));
        const promises = this.providers.map((p) => p.documentHighlights(currentNode, ancestors, params).catch(() => null));
        const results = await Promise.all(promises);
        return (_a = results.find(Boolean)) !== null && _a !== void 0 ? _a : exports.PREVENT_DEFAULT;
    }
}
exports.DocumentHighlightsProvider = DocumentHighlightsProvider;
//# sourceMappingURL=DocumentHighlightsProvider.js.map