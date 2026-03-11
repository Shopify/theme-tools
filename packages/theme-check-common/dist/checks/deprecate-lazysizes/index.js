"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeprecateLazysizes = void 0;
const types_1 = require("../../types");
const utils_1 = require("../utils");
function showsLazysizesUsage(attr) {
    return (0, utils_1.isAttr)(attr, 'data-srcset') || (0, utils_1.isAttr)(attr, 'data-sizes');
}
exports.DeprecateLazysizes = {
    meta: {
        code: 'DeprecateLazysizes',
        name: 'Deprecate Lazysizes',
        docs: {
            description: 'This check is aimed at discouraging the use of the lazysizes JavaScript library',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecate-lazysizes',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async HtmlVoidElement(node) {
                if (node.name !== 'img')
                    return;
                const attributes = node.attributes.filter(utils_1.isHtmlAttribute);
                const hasSrc = attributes.some((attr) => (0, utils_1.isAttr)(attr, 'src'));
                const hasNativeLoading = attributes.some((attr) => (0, utils_1.isAttr)(attr, 'loading'));
                if (hasSrc && hasNativeLoading)
                    return;
                const hasLazyloadClass = node.attributes
                    .filter(utils_1.isValuedHtmlAttribute)
                    .some((attr) => (0, utils_1.isAttr)(attr, 'class') && (0, utils_1.valueIncludes)(attr, 'lazyload'));
                if (!hasLazyloadClass)
                    return;
                const hasLazysizesAttribute = node.attributes
                    .filter(utils_1.isValuedHtmlAttribute)
                    .some(showsLazysizesUsage);
                if (!hasLazysizesAttribute)
                    return;
                context.report({
                    message: 'Use the native loading="lazy" attribute instead of lazysizes',
                    startIndex: node.position.start,
                    endIndex: node.position.end,
                });
            },
        };
    },
};
//# sourceMappingURL=index.js.map