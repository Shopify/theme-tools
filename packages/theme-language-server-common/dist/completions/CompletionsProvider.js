"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompletionsProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const TypeSystem_1 = require("../TypeSystem");
const params_1 = require("./params");
const providers_1 = require("./providers");
class CompletionsProvider {
    constructor({ documentManager, themeDocset, getMetafieldDefinitions, getTranslationsForURI = async () => ({}), getSnippetNamesForURI = async () => [], getThemeSettingsSchemaForURI = async () => [], getDocDefinitionForURI = async (uri, _relativePath) => ({ uri }), getThemeBlockNames = async (_rootUri, _includePrivate) => [], log = () => { }, }) {
        this.providers = [];
        this.documentManager = documentManager;
        this.themeDocset = themeDocset;
        this.log = log;
        const typeSystem = new TypeSystem_1.TypeSystem(themeDocset, getThemeSettingsSchemaForURI, getMetafieldDefinitions);
        this.providers = [
            new providers_1.ContentForCompletionProvider(),
            new providers_1.ContentForBlockTypeCompletionProvider(getThemeBlockNames),
            new providers_1.ContentForParameterCompletionProvider(getDocDefinitionForURI),
            new providers_1.HtmlTagCompletionProvider(),
            new providers_1.HtmlAttributeCompletionProvider(documentManager),
            new providers_1.HtmlAttributeValueCompletionProvider(),
            new providers_1.LiquidTagsCompletionProvider(themeDocset),
            new providers_1.ObjectCompletionProvider(typeSystem),
            new providers_1.ObjectAttributeCompletionProvider(typeSystem, getThemeSettingsSchemaForURI),
            new providers_1.FilterCompletionProvider(typeSystem),
            new providers_1.TranslationCompletionProvider(documentManager, getTranslationsForURI),
            new providers_1.RenderSnippetCompletionProvider(getSnippetNamesForURI),
            new providers_1.RenderSnippetParameterCompletionProvider(getDocDefinitionForURI),
            new providers_1.FilterNamedParameterCompletionProvider(themeDocset),
            new providers_1.LiquidDocTagCompletionProvider(),
            new providers_1.LiquidDocParamTypeCompletionProvider(themeDocset),
        ];
    }
    async completions(params) {
        const uri = params.textDocument.uri;
        const document = this.documentManager.get(uri);
        // Supports only Liquid resources
        if ((document === null || document === void 0 ? void 0 : document.type) !== theme_check_common_1.SourceCodeType.LiquidHtml) {
            return [];
        }
        try {
            const liquidParams = (0, params_1.createLiquidCompletionParams)(document, params);
            const promises = this.providers.map((p) => p.completions(liquidParams));
            const results = await Promise.all(promises);
            return results.flat();
        }
        catch (err) {
            this.log(`[SERVER] CompletionsProvider error: ${err}`);
            return [];
        }
    }
}
exports.CompletionsProvider = CompletionsProvider;
//# sourceMappingURL=CompletionsProvider.js.map