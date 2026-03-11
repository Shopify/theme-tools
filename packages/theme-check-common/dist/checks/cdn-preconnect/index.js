"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdnPreconnect = void 0;
const types_1 = require("../../types");
const utils_1 = require("../utils");
exports.CdnPreconnect = {
    meta: {
        code: 'CdnPreconnect',
        name: 'CDN Preconnect',
        docs: {
            description: "This check is aimed at signaling the redundant preconnect to Shopify's CDN",
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/cdn-preconnect',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async HtmlVoidElement(node) {
                if (node.name !== 'link')
                    return;
                const isPreconnect = node.attributes
                    .filter(utils_1.isValuedHtmlAttribute)
                    .some((attr) => (0, utils_1.isAttr)(attr, 'rel') && (0, utils_1.valueIncludes)(attr, 'preconnect'));
                if (!isPreconnect)
                    return;
                const isShopifyCdn = node.attributes
                    .filter(utils_1.isValuedHtmlAttribute)
                    .some((attr) => (0, utils_1.isAttr)(attr, 'href') && (0, utils_1.valueIncludes)(attr, '.+cdn.shopify.com.+'));
                if (!isShopifyCdn)
                    return;
                context.report({
                    message: 'Preconnecting to cdn.shopify.com is unnecessary and can lead to worse performance',
                    startIndex: node.position.start,
                    endIndex: node.position.end,
                });
            },
        };
    },
};
//# sourceMappingURL=index.js.map