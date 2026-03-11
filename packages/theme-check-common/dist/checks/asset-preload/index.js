"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetPreload = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../utils");
function isPreload(attr) {
    return ((0, utils_1.isAttr)(attr, 'rel') &&
        attr.value.some((node) => node.type === liquid_html_parser_1.NodeTypes.TextNode && node.value === 'preload'));
}
exports.AssetPreload = {
    meta: {
        code: 'AssetPreload',
        name: 'Prevent Manual Preloading of Assets',
        docs: {
            description: 'This check is aimed at discouraging the manual preloading of assets and encourages the use of appropriate Shopify filters.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/asset-preload',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async HtmlVoidElement(node) {
                var _a;
                const preloadLinkAttr = node.attributes.find((attr) => (0, utils_1.isValuedHtmlAttribute)(attr) && isPreload(attr));
                if (node.name === 'link' && preloadLinkAttr) {
                    const asAttr = node.attributes
                        .filter(utils_1.isValuedHtmlAttribute)
                        .find((attr) => (0, utils_1.isAttr)(attr, 'as'));
                    const assetType = (_a = asAttr === null || asAttr === void 0 ? void 0 : asAttr.value.find((node) => (0, utils_1.isNodeOfType)(liquid_html_parser_1.NodeTypes.TextNode, node))) === null || _a === void 0 ? void 0 : _a.value;
                    let message = '';
                    if (assetType === 'style') {
                        message =
                            'For better performance, prefer using the preload argument of the stylesheet_tag filter';
                    }
                    else if (assetType === 'image') {
                        message =
                            'For better performance, prefer using the preload argument of the image_tag filter';
                    }
                    else {
                        message = 'For better performance, prefer using the preload_tag filter';
                    }
                    context.report({
                        message,
                        startIndex: node.position.start,
                        endIndex: node.position.end,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map