"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaTranslationHoverProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const translations_1 = require("../../../translations");
const RequestContext_1 = require("../../RequestContext");
const utils_1 = require("../../utils");
class SchemaTranslationHoverProvider {
    constructor(getDefaultSchemaTranslations) {
        this.getDefaultSchemaTranslations = getDefaultSchemaTranslations;
    }
    canHover(context, path) {
        const label = (0, theme_check_common_1.deepGet)(context.parsed, path);
        return ((0, utils_1.isSectionOrBlockFile)(context.doc.uri) &&
            (0, RequestContext_1.isLiquidRequestContext)(context) &&
            path.length !== 0 &&
            label &&
            typeof label === 'string' &&
            label.startsWith('t:'));
    }
    async hover(context, path) {
        if (!this.canHover(context, path))
            return [];
        // Can assert is a string because of `canHover` check above
        const label = (0, theme_check_common_1.deepGet)(context.parsed, path);
        return this.getDefaultSchemaTranslations(context.doc.uri).then((translations) => {
            const path = label.slice(2); // remove `t:`
            const value = (0, translations_1.translationValue)(path, translations);
            if (!value)
                return undefined;
            return [(0, translations_1.renderTranslation)(value)];
        });
    }
}
exports.SchemaTranslationHoverProvider = SchemaTranslationHoverProvider;
//# sourceMappingURL=SchemaTranslationHoverProvider.js.map