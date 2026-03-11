"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const translations_1 = require("../../translations");
class TranslationHoverProvider {
    constructor(getTranslationsForUri, documentManager) {
        this.getTranslationsForUri = getTranslationsForUri;
        this.documentManager = documentManager;
    }
    async hover(currentNode, ancestors, params) {
        var _a;
        const parentNode = ancestors.at(-1);
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.String ||
            !parentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.LiquidVariable) {
            return null;
        }
        if (!parentNode.filters[0] || !['t', 'translate'].includes(parentNode.filters[0].name)) {
            return null;
        }
        const translations = await this.getTranslationsForUri(params.textDocument.uri);
        const translation = (0, translations_1.translationValue)(currentNode.value, translations);
        const document = (_a = this.documentManager.get(params.textDocument.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        if (!translation || !document) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, translations_1.renderTranslation)(translation),
            },
            range: {
                start: document.positionAt(currentNode.position.start),
                end: document.positionAt(currentNode.position.end),
            },
        };
    }
}
exports.TranslationHoverProvider = TranslationHoverProvider;
//# sourceMappingURL=TranslationHoverProvider.js.map