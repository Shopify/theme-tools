"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HoverProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const TypeSystem_1 = require("../TypeSystem");
const providers_1 = require("./providers");
const HtmlAttributeValueHoverProvider_1 = require("./providers/HtmlAttributeValueHoverProvider");
const theme_check_common_2 = require("@shopify/theme-check-common");
const LiquidDocTagHoverProvider_1 = require("./providers/LiquidDocTagHoverProvider");
const ContentForArgumentHoverProvider_1 = require("./providers/ContentForArgumentHoverProvider");
const ContentForTypeHoverProvider_1 = require("./providers/ContentForTypeHoverProvider");
class HoverProvider {
    constructor(documentManager, themeDocset, getMetafieldDefinitions, getTranslationsForURI = async () => ({}), getSettingsSchemaForURI = async () => [], getDocDefinitionForURI = async () => undefined) {
        this.documentManager = documentManager;
        this.themeDocset = themeDocset;
        this.getMetafieldDefinitions = getMetafieldDefinitions;
        this.getTranslationsForURI = getTranslationsForURI;
        this.getSettingsSchemaForURI = getSettingsSchemaForURI;
        this.getDocDefinitionForURI = getDocDefinitionForURI;
        this.providers = [];
        const typeSystem = new TypeSystem_1.TypeSystem(themeDocset, getSettingsSchemaForURI, getMetafieldDefinitions);
        this.providers = [
            new ContentForArgumentHoverProvider_1.ContentForArgumentHoverProvider(getDocDefinitionForURI),
            new ContentForTypeHoverProvider_1.ContentForTypeHoverProvider(getDocDefinitionForURI),
            new providers_1.LiquidTagHoverProvider(themeDocset),
            new providers_1.LiquidFilterArgumentHoverProvider(themeDocset),
            new providers_1.LiquidFilterHoverProvider(themeDocset),
            new providers_1.LiquidObjectHoverProvider(typeSystem),
            new providers_1.LiquidObjectAttributeHoverProvider(typeSystem),
            new providers_1.HtmlTagHoverProvider(),
            new providers_1.HtmlAttributeHoverProvider(),
            new HtmlAttributeValueHoverProvider_1.HtmlAttributeValueHoverProvider(),
            new providers_1.TranslationHoverProvider(getTranslationsForURI, documentManager),
            new providers_1.RenderSnippetHoverProvider(getDocDefinitionForURI),
            new providers_1.RenderSnippetParameterHoverProvider(getDocDefinitionForURI),
            new LiquidDocTagHoverProvider_1.LiquidDocTagHoverProvider(documentManager),
        ];
    }
    async hover(params) {
        var _a;
        const uri = params.textDocument.uri;
        const document = this.documentManager.get(uri);
        // Supports only Liquid resources
        if ((document === null || document === void 0 ? void 0 : document.type) !== theme_check_common_1.SourceCodeType.LiquidHtml || document.ast instanceof Error) {
            return null;
        }
        const [currentNode, ancestors] = (0, theme_check_common_2.findCurrentNode)(document.ast, document.textDocument.offsetAt(params.position));
        const promises = this.providers.map((p) => p.hover(currentNode, ancestors, params));
        const results = await Promise.all(promises);
        return (_a = results.find(Boolean)) !== null && _a !== void 0 ? _a : null;
    }
}
exports.HoverProvider = HoverProvider;
//# sourceMappingURL=HoverProvider.js.map