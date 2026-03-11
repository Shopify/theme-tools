"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaTranslationsCompletionProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_json_languageservice_1 = require("vscode-json-languageservice");
const translations_1 = require("../../../translations");
const RequestContext_1 = require("../../RequestContext");
const utils_1 = require("../../utils");
class SchemaTranslationsCompletionProvider {
    constructor(getDefaultSchemaTranslations) {
        this.getDefaultSchemaTranslations = getDefaultSchemaTranslations;
    }
    async completeValue(context, path) {
        var _a;
        if (!(0, utils_1.isSectionOrBlockFile)(context.doc.uri) || !(0, RequestContext_1.isLiquidRequestContext)(context)) {
            return [];
        }
        const { doc, parsed } = context;
        const label = (0, theme_check_common_1.deepGet)(parsed, path);
        if (!label || typeof label !== 'string' || !label.startsWith('t:')) {
            return [];
        }
        const partial = (_a = /^t:(.*)/.exec(label)) === null || _a === void 0 ? void 0 : _a[1];
        if (partial === undefined)
            return [];
        const translations = await this.getDefaultSchemaTranslations(doc.uri);
        // We'll let the frontend do the filtering. But we'll only include shopify
        // translations if the shopify prefix is present
        const options = (0, translations_1.translationOptions)(translations);
        return options.map((option) => {
            const tLabel = `t:${option.path.join('.')}`;
            return {
                label: tLabel,
                kind: vscode_json_languageservice_1.CompletionItemKind.Value,
                filterText: `"${tLabel}"`,
                insertText: `"${tLabel}"`,
                insertTextFormat: 1,
                documentation: {
                    kind: 'markdown',
                    value: (0, translations_1.renderTranslation)(option.translation),
                },
            };
        });
    }
}
exports.SchemaTranslationsCompletionProvider = SchemaTranslationsCompletionProvider;
//# sourceMappingURL=SchemaTranslationCompletionProvider.js.map