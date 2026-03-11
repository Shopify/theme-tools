"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsHoverProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const translations_1 = require("../../../translations");
const RequestContext_1 = require("../../RequestContext");
const utils_1 = require("../../utils");
const BlockTypeCompletionProvider_1 = require("../../completions/providers/BlockTypeCompletionProvider");
class SettingsHoverProvider {
    constructor(getDefaultSchemaTranslations) {
        this.getDefaultSchemaTranslations = getDefaultSchemaTranslations;
    }
    canHover(context, path) {
        return ((0, utils_1.isSectionOrBlockFile)(context.doc.uri) &&
            (0, RequestContext_1.isLiquidRequestContext)(context) &&
            path.length !== 0 &&
            (isPresetsSettingsPath(path) || isDefaultSettingsPath(path)));
    }
    async hover(context, path) {
        if (!this.canHover(context, path))
            return [];
        const { doc } = context;
        const label = await getSettingsLabel(doc, path.at(-1));
        if (!label)
            return [];
        if (!label.startsWith('t:')) {
            return [label];
        }
        return this.getDefaultSchemaTranslations(doc.uri).then((translations) => {
            const path = label.substring(2);
            const value = (0, translations_1.translationValue)(path, translations);
            if (!value)
                return undefined;
            return [(0, translations_1.renderTranslation)(value)];
        });
    }
}
exports.SettingsHoverProvider = SettingsHoverProvider;
function isPresetsSettingsPath(path) {
    return (path.at(0) === 'presets' &&
        path.at(2) === 'settings' &&
        path.at(3) !== undefined &&
        typeof path.at(3) === 'string');
}
function isDefaultSettingsPath(path) {
    return (path.at(0) === 'default' &&
        path.at(1) === 'settings' &&
        path.at(2) !== undefined &&
        typeof path.at(2) === 'string');
}
async function getSettingsLabel(doc, label) {
    var _a;
    const schema = await doc.getSchema();
    if (!schema ||
        !(0, BlockTypeCompletionProvider_1.isSectionOrBlockSchema)(schema) ||
        (0, theme_check_common_1.isError)(schema.parsed) ||
        schema.parsed.settings === undefined ||
        !Array.isArray(schema.parsed.settings)) {
        return;
    }
    return (_a = schema.parsed.settings.find((setting) => (setting === null || setting === void 0 ? void 0 : setting.id) === label)) === null || _a === void 0 ? void 0 : _a.label;
}
//# sourceMappingURL=SettingsHoverProvider.js.map