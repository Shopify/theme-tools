"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImgWidthAndHeight = void 0;
const types_1 = require("../../types");
const utils_1 = require("../utils");
exports.ImgWidthAndHeight = {
    meta: {
        code: 'ImgWidthAndHeight',
        name: 'Width and height attributes on image tags',
        docs: {
            description: 'This check is aimed at eliminating content layout shift in themes by enforcing the use of the width and height attributes on img tags.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/img-width-and-height',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async HtmlVoidElement(node) {
                if (node.name === 'img') {
                    const widthAttr = node.attributes.find((attr) => (0, utils_1.isValuedHtmlAttribute)(attr) && (0, utils_1.isAttr)(attr, 'width'));
                    const heightAttr = node.attributes.find((attr) => (0, utils_1.isValuedHtmlAttribute)(attr) && (0, utils_1.isAttr)(attr, 'height'));
                    let missingAttributes = [];
                    if (!widthAttr) {
                        missingAttributes.push('width');
                    }
                    if (!heightAttr) {
                        missingAttributes.push('height');
                    }
                    if (missingAttributes.length > 0) {
                        const attributeWord = missingAttributes.length === 1 ? 'attribute' : 'attributes';
                        context.report({
                            message: `Missing ${missingAttributes.join(' and ')} ${attributeWord} on img tag`,
                            startIndex: node.position.start,
                            endIndex: node.position.end,
                        });
                    }
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map