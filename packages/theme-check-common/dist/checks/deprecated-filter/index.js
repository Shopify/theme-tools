"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeprecatedFilter = void 0;
const types_1 = require("../../types");
const fixes_1 = require("./fixes");
exports.DeprecatedFilter = {
    meta: {
        code: 'DeprecatedFilter',
        aliases: ['DeprecatedFilters'],
        name: 'Deprecated Filter',
        docs: {
            description: 'Discourages using deprecated filters in themes.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecated-filter',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        if (!context.themeDocset) {
            return {};
        }
        return {
            LiquidFilter: async (node) => {
                const filters = await context.themeDocset.filters();
                const deprecatedFilter = filters.find((f) => {
                    return f.deprecated && f.name === node.name;
                });
                if (!deprecatedFilter) {
                    return;
                }
                const recommendedFilterName = findRecommendedAlternative(deprecatedFilter);
                const recommendedFilter = filters.find((f) => f.name === recommendedFilterName);
                const message = deprecatedFilterMessage(deprecatedFilter, recommendedFilter);
                const suggest = deprecatedFilterSuggestion(node);
                const fix = deprecatedFilterFix(node);
                context.report({
                    message,
                    suggest,
                    fix,
                    startIndex: node.position.start + 1,
                    endIndex: node.position.end,
                });
            },
        };
    },
};
function deprecatedFilterSuggestion(node) {
    const filter = node.name;
    switch (filter) {
        case 'img_tag':
            return (0, fixes_1.suggestImgTagFix)(node);
        case 'img_url':
            return (0, fixes_1.suggestImgUrlFix)(node);
        case 'article_img_url':
        case 'collection_img_url':
        case 'product_img_url':
            /**
             * These filters rely on the usage of the `image_url`
             * filter as the fix.
             */
            return (0, fixes_1.suggestImageUrlFix)(filter, node);
        case 'currency_selector':
            /**
             * Cannot be fixed.
             *
             * Deprecated without a direct replacement because the
             * currency form has also been deprecated. The currency
             * form was replaced by the localization form.
             */
            return;
    }
}
function deprecatedFilterFix(node) {
    const filter = node.name;
    if (filter === 'hex_to_rgba') {
        return (0, fixes_1.fixHexToRgba)(node);
    }
}
function deprecatedFilterMessage(deprecated, recommended) {
    if (recommended) {
        return `Deprecated filter '${deprecated.name}', consider using '${recommended.name}'.`;
    }
    return `Deprecated filter '${deprecated.name}'.`;
}
function findRecommendedAlternative(deprecatedFilter) {
    const reason = deprecatedFilter.deprecation_reason;
    const match = reason === null || reason === void 0 ? void 0 : reason.match(/replaced by \[`(.+?)`\]/);
    return match === null || match === void 0 ? void 0 : match[1];
}
//# sourceMappingURL=index.js.map