"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockSettingsHoverProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const translations_1 = require("../../../translations");
const RequestContext_1 = require("../../RequestContext");
const utils_1 = require("../../utils");
const BlockTypeCompletionProvider_1 = require("../../completions/providers/BlockTypeCompletionProvider");
const schemaSettings_1 = require("../../schemaSettings");
class BlockSettingsHoverProvider {
    constructor(getDefaultSchemaTranslations, getThemeBlockSchema) {
        this.getDefaultSchemaTranslations = getDefaultSchemaTranslations;
        this.getThemeBlockSchema = getThemeBlockSchema;
    }
    canHover(context, path) {
        return ((0, utils_1.isSectionOrBlockFile)(context.doc.uri) &&
            (0, RequestContext_1.isLiquidRequestContext)(context) &&
            path.length !== 0 &&
            isBlocksSettingsPath(path));
    }
    async hover(context, path) {
        if (!this.canHover(context, path))
            return [];
        const { doc } = context;
        const schema = await doc.getSchema();
        if (!isValidSchema(schema))
            return [];
        const blockType = (0, theme_check_common_1.deepGet)(schema.parsed, [...path.slice(0, -2), 'type']);
        if (!blockType)
            return [];
        const sectionBlock = (0, schemaSettings_1.getSectionBlockByName)(schema.parsed, blockType);
        let label;
        if (sectionBlock) {
            if (!hasValidSettings(sectionBlock.settings))
                return [];
            label = getSettingLabelById(sectionBlock.settings, path.at(-1));
        }
        else {
            const themeBlockSchema = await this.getThemeBlockSchema(doc.uri, blockType);
            if (!isValidSchema(themeBlockSchema))
                return [];
            if (!hasValidSettings(themeBlockSchema.parsed.settings))
                return [];
            label = getSettingLabelById(themeBlockSchema.parsed.settings, path.at(-1));
        }
        if (!label)
            return [];
        if (!label.startsWith('t:')) {
            return [label];
        }
        const translations = await this.getDefaultSchemaTranslations(doc.uri);
        const value = (0, translations_1.translationValue)(label.substring(2), translations);
        if (!value)
            return [];
        return [(0, translations_1.renderTranslation)(value)];
    }
}
exports.BlockSettingsHoverProvider = BlockSettingsHoverProvider;
function isBlocksSettingsPath(path) {
    return ((path.at(0) === 'presets' || path.at(0) === 'default') &&
        path.at(-4) === 'blocks' &&
        path.at(-2) === 'settings' &&
        path.at(-1) !== undefined &&
        typeof path.at(-1) === 'string');
}
function isValidSchema(schema) {
    return !!schema && !(0, theme_check_common_1.isError)(schema.parsed) && (0, BlockTypeCompletionProvider_1.isSectionOrBlockSchema)(schema);
}
function hasValidSettings(settings) {
    return settings !== undefined && Array.isArray(settings);
}
function getSettingLabelById(settings, id) {
    var _a;
    return (_a = settings.find((setting) => setting.id === id)) === null || _a === void 0 ? void 0 : _a.label;
}
//# sourceMappingURL=BlockSettingsHoverProvider.js.map