"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONContributions = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const BlockTypeCompletionProvider_1 = require("./completions/providers/BlockTypeCompletionProvider");
const ReferencedBlockTypeCompletionProvider_1 = require("./completions/providers/ReferencedBlockTypeCompletionProvider");
const SchemaTranslationCompletionProvider_1 = require("./completions/providers/SchemaTranslationCompletionProvider");
const SchemaTranslationHoverProvider_1 = require("./hover/providers/SchemaTranslationHoverProvider");
const TranslationPathHoverProvider_1 = require("./hover/providers/TranslationPathHoverProvider");
const utils_1 = require("./utils");
const SettingsPropertyCompletionProvider_1 = require("./completions/providers/SettingsPropertyCompletionProvider");
const SettingsHoverProvider_1 = require("./hover/providers/SettingsHoverProvider");
const BlockSettingsPropertyCompletionProvider_1 = require("./completions/providers/BlockSettingsPropertyCompletionProvider");
const BlockSettingsHoverProvider_1 = require("./hover/providers/BlockSettingsHoverProvider");
/** The getInfoContribution API will only fallback if we return undefined synchronously */
const SKIP_CONTRIBUTION = undefined;
/**
 * I'm not a fan of how json-languageservice does its feature contributions. It's too different
 * from everything else we do in here.
 *
 * Instead, we'll have this little adapter that makes the completions and hover providers feel
 * a bit more familiar.
 */
class JSONContributions {
    constructor(documentManager, getDefaultSchemaTranslations, getThemeBlockNames, getThemeBlockSchema) {
        this.documentManager = documentManager;
        this.hoverProviders = [
            new TranslationPathHoverProvider_1.TranslationPathHoverProvider(),
            new SchemaTranslationHoverProvider_1.SchemaTranslationHoverProvider(getDefaultSchemaTranslations),
            new SettingsHoverProvider_1.SettingsHoverProvider(getDefaultSchemaTranslations),
            new BlockSettingsHoverProvider_1.BlockSettingsHoverProvider(getDefaultSchemaTranslations, getThemeBlockSchema),
        ];
        this.completionProviders = [
            new SchemaTranslationCompletionProvider_1.SchemaTranslationsCompletionProvider(getDefaultSchemaTranslations),
            new BlockTypeCompletionProvider_1.BlockTypeCompletionProvider(getThemeBlockNames),
            new ReferencedBlockTypeCompletionProvider_1.ReferencedBlockTypeCompletionProvider(getThemeBlockNames, getThemeBlockSchema),
            new BlockSettingsPropertyCompletionProvider_1.BlockSettingsPropertyCompletionProvider(getDefaultSchemaTranslations, getThemeBlockSchema),
            new SettingsPropertyCompletionProvider_1.SettingsPropertyCompletionProvider(getDefaultSchemaTranslations),
        ];
    }
    getInfoContribution(uri, location) {
        const doc = this.documentManager.get(uri);
        if (!doc)
            return SKIP_CONTRIBUTION;
        const context = this.getContext(doc);
        const provider = this.hoverProviders.find((p) => p.canHover(context, location));
        if (!provider)
            return SKIP_CONTRIBUTION;
        return provider.hover(context, location);
    }
    async collectPropertyCompletions(uri, location, 
    // Don't know what those three are for.
    _currentWord, _addValue, _isLast, result) {
        const doc = this.documentManager.get(uri);
        if (!doc || doc.ast instanceof Error)
            return;
        const items = await Promise.all(this.completionProviders
            .filter((provider) => provider.completeProperty)
            .map((provider) => provider.completeProperty(this.getContext(doc), location)));
        for (const item of items.flat()) {
            result.add(item);
        }
    }
    async collectValueCompletions(uri, location, propertyKey, result) {
        const doc = this.documentManager.get(uri);
        if (!doc || doc.ast instanceof Error)
            return;
        const items = await Promise.all(this.completionProviders
            .filter((provider) => provider.completeValue)
            .map((provider) => provider.completeValue(this.getContext(doc), location.concat(propertyKey))));
        for (const item of items.flat()) {
            result.add(item);
        }
    }
    /** I'm not sure we want to do anything with that... but TS requires us to have it */
    async collectDefaultCompletions(_uri, _result) { }
    getContext(doc) {
        const context = {
            doc,
        };
        if (doc.type === theme_check_common_1.SourceCodeType.LiquidHtml && !(doc.ast instanceof Error)) {
            const schema = (0, utils_1.findSchemaNode)(doc.ast);
            if (!schema)
                return SKIP_CONTRIBUTION;
            const jsonString = schema === null || schema === void 0 ? void 0 : schema.source.slice(schema.blockStartPosition.end, schema.blockEndPosition.start);
            context.schema = schema;
            context.parsed = (0, theme_check_common_1.parseJSON)(jsonString);
        }
        return context;
    }
}
exports.JSONContributions = JSONContributions;
//# sourceMappingURL=JSONContributions.js.map