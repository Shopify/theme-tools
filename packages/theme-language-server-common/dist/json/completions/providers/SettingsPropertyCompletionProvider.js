"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsPropertyCompletionProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const utils_1 = require("../../utils");
const BlockTypeCompletionProvider_1 = require("./BlockTypeCompletionProvider");
const schemaSettings_1 = require("../../schemaSettings");
/**
 * The SettingsPropertyCompletionProvider offers property completions for:
 * - `presets.[].settings.[]` objects inside `{% schema %}` tag in sections and blocks
 * - `default.settings` object inside `{% schema %}` tag in sections
 *
 * @example
 * {% schema %}
 * {
 *   "presets": [
 *     {
 *       "settings": [
 *         { "█" },
 *       ]
 *     },
 *   ],
 *   "default": {
 *     "settings": {
 *       "█"
 *     }
 *   }
 * }
 * {% endschema %}
 */
class SettingsPropertyCompletionProvider {
    constructor(getDefaultSchemaTranslations) {
        this.getDefaultSchemaTranslations = getDefaultSchemaTranslations;
    }
    async completeProperty(context, path) {
        const { doc } = context;
        if (doc.type !== theme_check_common_1.SourceCodeType.LiquidHtml)
            return [];
        // section files can have schemas with `presets` and `default`
        // block files can have schemas with `presets` only
        if (!((0, utils_1.isSectionFile)(doc.uri) && (isPresetSettingsPath(path) || isDefaultSettingsPath(path))) &&
            !((0, utils_1.isBlockFile)(doc.uri) && isPresetSettingsPath(path))) {
            return [];
        }
        const schema = await doc.getSchema();
        if (!schema || !(0, BlockTypeCompletionProvider_1.isSectionOrBlockSchema)(schema) || (0, theme_check_common_1.isError)(schema.parsed)) {
            return [];
        }
        const parsedSchema = schema.parsed;
        if (!(parsedSchema === null || parsedSchema === void 0 ? void 0 : parsedSchema.settings) || !Array.isArray(parsedSchema.settings)) {
            return [];
        }
        const translations = await this.getDefaultSchemaTranslations(doc.textDocument.uri);
        return (0, schemaSettings_1.schemaSettingsPropertyCompletionItems)(parsedSchema.settings, translations);
    }
}
exports.SettingsPropertyCompletionProvider = SettingsPropertyCompletionProvider;
function isPresetSettingsPath(path) {
    return path.length === 3 && path.at(0) === 'presets' && path.at(2) === 'settings';
}
function isDefaultSettingsPath(path) {
    return path.length === 2 && path.at(0) === 'default' && path.at(1) === 'settings';
}
//# sourceMappingURL=SettingsPropertyCompletionProvider.js.map