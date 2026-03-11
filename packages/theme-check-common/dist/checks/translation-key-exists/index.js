"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationKeyExists = void 0;
const json_1 = require("../../json");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
function keyExists(key, pointer) {
    for (const token of key.split('.')) {
        if (typeof pointer !== 'object') {
            return false;
        }
        if (!pointer.hasOwnProperty(token)) {
            return false;
        }
        pointer = pointer[token];
    }
    return true;
}
exports.TranslationKeyExists = {
    meta: {
        code: 'TranslationKeyExists',
        name: 'Reports missing translation keys',
        docs: {
            description: 'Reports missing translation keys',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/translation-key-exists',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        const nodes = [];
        let schemaLocales;
        return {
            async LiquidVariable(node) {
                if (node.expression.type !== 'String') {
                    return;
                }
                if (!node.filters.some(({ name }) => ['t', 'translate'].includes(name))) {
                    return;
                }
                nodes.push({
                    translationKey: node.expression.value,
                    startIndex: node.expression.position.start,
                    endIndex: node.expression.position.end,
                });
            },
            async LiquidRawTag(node) {
                var _a;
                if (node.name !== 'schema' || node.body.kind !== 'json') {
                    return;
                }
                const defaultLocale = await context.getDefaultLocale();
                const schema = (0, json_1.parseJSON)(node.body.value);
                if ((0, utils_1.isError)(schema) && schema instanceof SyntaxError)
                    return;
                schemaLocales = (_a = schema.locales) === null || _a === void 0 ? void 0 : _a[defaultLocale];
            },
            async onCodePathEnd() {
                var _a;
                const defaultTranslations = await context.getDefaultTranslations();
                const defaultLocale = await context.getDefaultLocale();
                const systemTranslations = await ((_a = context.themeDocset) === null || _a === void 0 ? void 0 : _a.systemTranslations());
                const systemTranslationsKeys = Object.keys(systemTranslations !== null && systemTranslations !== void 0 ? systemTranslations : {});
                if (!defaultTranslations && systemTranslationsKeys.length === 0)
                    return;
                nodes.forEach(({ translationKey, startIndex, endIndex }) => {
                    if (keyExists(translationKey, defaultTranslations) ||
                        keyExists(translationKey, schemaLocales) ||
                        systemTranslationsKeys.includes(translationKey)) {
                        return;
                    }
                    let message = `'${translationKey}' does not have a matching entry in 'locales/${defaultLocale}.default.json'`;
                    if (schemaLocales) {
                        message += ` or '${context.toRelativePath(context.file.uri)}'`;
                    }
                    context.report({
                        message,
                        startIndex,
                        endIndex,
                    });
                });
            },
        };
    },
};
//# sourceMappingURL=index.js.map