"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockSettingsPropertyCompletionProvider = void 0;
const utils_1 = require("../../utils");
const theme_check_common_1 = require("@shopify/theme-check-common");
const BlockTypeCompletionProvider_1 = require("./BlockTypeCompletionProvider");
const schemaSettings_1 = require("../../schemaSettings");
/**
 * The BlockSettingsPropertyCompletionProvider offers value completions of the
 * `presets.[].(recursive blocks.[]).settings` keys and `defaults.blocks.[].settings` keys inside
 * `{% schema %}` tags.
 *
 * @example
 * {% schema %}
 * {
 *   "presets": [
 *     {
 *       "blocks": [
 *         {
 *           "type": "block-type",
 *           "settings": {
 *             "█"
 *           }
 *         },
 *       ]
 *     },
 *   ],
 *   "default": {
 *     "blocks": [
 *       {
 *         "type": "block-type",
 *         "settings": {
 *           "█"
 *         }
 *       },
 *     ]
 *   }
 * }
 * {% endschema %}
 */
class BlockSettingsPropertyCompletionProvider {
    constructor(getDefaultSchemaTranslations, getThemeBlockSchema) {
        this.getDefaultSchemaTranslations = getDefaultSchemaTranslations;
        this.getThemeBlockSchema = getThemeBlockSchema;
    }
    async completeProperty(context, path) {
        var _a, _b;
        const { doc } = context;
        if (doc.type !== theme_check_common_1.SourceCodeType.LiquidHtml)
            return [];
        // section files can have schemas with `presets` and `default`
        // block files can have schemas with `presets` only
        if (!((0, utils_1.isSectionFile)(doc.uri) &&
            (isPresetsBlocksSettingsPath(path) || isDefaultBlocksSettingsPath(path))) &&
            !((0, utils_1.isBlockFile)(doc.uri) && isPresetsBlocksSettingsPath(path))) {
            return [];
        }
        const schema = await doc.getSchema();
        if (!schema || !(0, BlockTypeCompletionProvider_1.isSectionOrBlockSchema)(schema) || (0, theme_check_common_1.isError)(schema.parsed)) {
            return [];
        }
        const blockType = (0, theme_check_common_1.deepGet)(schema.parsed, [...path.slice(0, -1), 'type']);
        if (!blockType) {
            return [];
        }
        const translations = await this.getDefaultSchemaTranslations(doc.textDocument.uri);
        const localBlock = (0, schemaSettings_1.getSectionBlockByName)(schema.parsed, blockType);
        if (localBlock) {
            if (localBlock.settings) {
                return (0, schemaSettings_1.schemaSettingsPropertyCompletionItems)(localBlock.settings, translations);
            }
        }
        else {
            const blockOriginSchema = await this.getThemeBlockSchema(doc.uri, blockType);
            if (!blockOriginSchema ||
                (0, theme_check_common_1.isError)(blockOriginSchema.parsed) ||
                !(0, BlockTypeCompletionProvider_1.isSectionOrBlockSchema)(blockOriginSchema)) {
                return [];
            }
            if (!((_a = blockOriginSchema.parsed) === null || _a === void 0 ? void 0 : _a.settings) ||
                !Array.isArray((_b = blockOriginSchema.parsed) === null || _b === void 0 ? void 0 : _b.settings)) {
                return [];
            }
            return (0, schemaSettings_1.schemaSettingsPropertyCompletionItems)(blockOriginSchema.parsed.settings, translations);
        }
        return [];
    }
}
exports.BlockSettingsPropertyCompletionProvider = BlockSettingsPropertyCompletionProvider;
// `blocks` can be nested within other `blocks`
// We need to ensure the last leg of the path is { "blocks": [{ "settings": { "█" } }] }
function isPresetsBlocksSettingsPath(path) {
    return path.at(0) === 'presets' && path.at(-3) === 'blocks' && path.at(-1) === 'settings';
}
// `blocks` inside `default` can't be nested within other `blocks`
function isDefaultBlocksSettingsPath(path) {
    return path.at(0) === 'default' && path.at(1) === 'blocks' && path.at(3) === 'settings';
}
//# sourceMappingURL=BlockSettingsPropertyCompletionProvider.js.map