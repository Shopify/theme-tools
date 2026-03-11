"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeprecateBgsizes = void 0;
const types_1 = require("../../types");
const utils_1 = require("../utils");
exports.DeprecateBgsizes = {
    meta: {
        code: 'DeprecateBgsizes',
        name: 'Deprecate Bgsizes',
        docs: {
            description: 'This check is aimed at discouraging the use of the lazySizes bgset plugin.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecate-bgsizes',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async HtmlElement(node) {
                const classAttributeWithLazyload = node.attributes
                    .filter(utils_1.isValuedHtmlAttribute)
                    .find((attr) => (0, utils_1.isAttr)(attr, 'class') && (0, utils_1.valueIncludes)(attr, 'lazyload'));
                if (classAttributeWithLazyload) {
                    const attr = classAttributeWithLazyload;
                    context.report({
                        message: 'Use the native loading="lazy" attribute instead of lazysizes',
                        startIndex: attr.attributePosition.start,
                        endIndex: attr.attributePosition.end,
                    });
                }
                const dataBgsetAttr = node.attributes.find((attr) => (0, utils_1.isValuedHtmlAttribute)(attr) && (0, utils_1.isAttr)(attr, 'data-bgset'));
                if (dataBgsetAttr) {
                    context.report({
                        message: 'Use the CSS imageset attribute instead of data-bgset',
                        startIndex: dataBgsetAttr.position.start,
                        endIndex: dataBgsetAttr.position.end,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map