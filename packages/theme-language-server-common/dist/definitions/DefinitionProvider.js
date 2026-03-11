"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const SchemaTranslationStringDefinitionProvider_1 = require("./providers/SchemaTranslationStringDefinitionProvider");
const TranslationStringDefinitionProvider_1 = require("./providers/TranslationStringDefinitionProvider");
class DefinitionProvider {
    constructor(documentManager, getDefaultLocaleSourceCode, getDefaultSchemaLocaleSourceCode) {
        this.documentManager = documentManager;
        this.providers = [
            new TranslationStringDefinitionProvider_1.TranslationStringDefinitionProvider(documentManager, getDefaultLocaleSourceCode),
            new SchemaTranslationStringDefinitionProvider_1.SchemaTranslationStringDefinitionProvider(documentManager, getDefaultSchemaLocaleSourceCode),
        ];
    }
    async definitions(params) {
        const sourceCode = this.documentManager.get(params.textDocument.uri);
        if (!sourceCode ||
            sourceCode.type !== theme_check_common_1.SourceCodeType.LiquidHtml ||
            sourceCode.ast instanceof Error) {
            return null;
        }
        const { textDocument } = sourceCode;
        const [node, ancestors] = (0, theme_check_common_1.findCurrentNode)(sourceCode.ast, textDocument.offsetAt(params.position));
        const results = await Promise.all(this.providers.map((provider) => provider.definitions(params, node, ancestors))).then((res) => res.flat());
        return results.length > 0 ? results : null;
    }
}
exports.DefinitionProvider = DefinitionProvider;
//# sourceMappingURL=DefinitionProvider.js.map