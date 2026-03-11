"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetSizeCSS = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const file_utils_1 = require("../../utils/file-utils");
const utils_2 = require("../utils");
const schema = {
    thresholdInBytes: types_1.SchemaProp.number(100000),
};
function isTextNode(node) {
    return node.type === liquid_html_parser_1.NodeTypes.TextNode;
}
function isLiquidVariableOutput(node) {
    return node.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput;
}
function isLiquidVariable(node) {
    return typeof node !== 'string' && node.type === liquid_html_parser_1.NodeTypes.LiquidVariable;
}
function isString(node) {
    return node.type === liquid_html_parser_1.NodeTypes.String;
}
exports.AssetSizeCSS = {
    meta: {
        code: 'AssetSizeCSS',
        aliases: ['AssetSizeCSSStylesheetTag'],
        name: 'Prevent Large CSS bundles',
        docs: {
            description: 'This check is aimed at preventing large CSS bundles for speed.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/asset-size-css',
            recommended: false,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema,
        targets: [],
    },
    create(context) {
        if (!context.fileSize) {
            return {};
        }
        const thresholdInBytes = context.settings.thresholdInBytes;
        async function checkRemoteAssetSize(url, position) {
            if (await (0, file_utils_1.hasRemoteAssetSizeExceededThreshold)(url, thresholdInBytes)) {
                context.report({
                    message: `The CSS file size exceeds the threshold of ${thresholdInBytes} bytes`,
                    startIndex: position.start,
                    endIndex: position.end,
                });
            }
        }
        async function checkThemeAssetSize(srcValue, position) {
            if (await (0, file_utils_1.hasLocalAssetSizeExceededThreshold)(context, `assets/${srcValue}`, thresholdInBytes)) {
                context.report({
                    message: `The CSS file size exceeds the threshold of ${thresholdInBytes} bytes`,
                    startIndex: position.start,
                    endIndex: position.end,
                });
            }
        }
        return {
            async HtmlVoidElement(node) {
                if (node.name !== 'link')
                    return;
                const relIsStylesheet = node.attributes
                    .filter(utils_2.isValuedHtmlAttribute)
                    .find((attr) => (0, utils_2.isAttr)(attr, 'rel') && (0, utils_2.valueIncludes)(attr, 'stylesheet'));
                if (!relIsStylesheet)
                    return;
                const href = node.attributes
                    .filter(utils_2.isValuedHtmlAttribute)
                    .find((attr) => (0, utils_2.isAttr)(attr, 'href'));
                if (!href)
                    return;
                if (href.value.length !== 1)
                    return;
                /* This ensures that the link entered is a text and not anything else like http//..{}
                   This also checks if the value starts with 'http://', 'https://' or '//' to ensure its a valid link. */
                if (isTextNode(href.value[0]) && /(https?:)?\/\//.test(href.value[0].value)) {
                    const url = href.value[0].value;
                    await checkRemoteAssetSize(url, href.attributePosition);
                }
                /* This code checks if we have a link with a liquid variable
                and that its a string with one filter, `asset_url`. This is done to ensure our .css link is
                entered with a 'asset_url' to produce valid output. */
                if (isLiquidVariableOutput(href.value[0]) &&
                    isLiquidVariable(href.value[0].markup) &&
                    isString(href.value[0].markup.expression) &&
                    href.value[0].markup.filters.length === 1 &&
                    href.value[0].markup.filters[0].name === 'asset_url') {
                    const assetName = href.value[0].markup.expression.value;
                    await checkThemeAssetSize(assetName, href.attributePosition);
                }
            },
            async LiquidFilter(node, ancestors) {
                if (node.name !== 'stylesheet_tag')
                    return;
                const liquidVariableParent = (0, utils_1.last)(ancestors);
                if (!liquidVariableParent || !(0, utils_2.isNodeOfType)(liquid_html_parser_1.NodeTypes.LiquidVariable, liquidVariableParent))
                    return;
                if (liquidVariableParent.expression.type !== liquid_html_parser_1.NodeTypes.String)
                    return;
                /* This code ensures we have a liquid variable with 1 expression, 1 filter, and that it is a valid http link.
                   This is done to ensure a valid http link is entered with 1 filter being the `stylesheet_tag` for valid output. */
                if (liquidVariableParent.expression.value[0].length == 1 &&
                    liquidVariableParent.filters.length == 1 &&
                    /(https?:)?\/\//.test(liquidVariableParent.expression.value)) {
                    const url = liquidVariableParent.expression.value;
                    await checkRemoteAssetSize(url, liquidVariableParent.expression.position);
                }
                /* This code ensures we have a liquid variable with 1 expression, 2 filters being asset_url and stylesheet_tag
                   This is done to ensure a .css file has the 'asset_url' and 'stylesheet_tag' to produce the appropriate output. */
                if (liquidVariableParent.expression.value[0].length == 1 &&
                    liquidVariableParent.filters.length == 2 &&
                    liquidVariableParent.filters[0].name === 'asset_url' &&
                    liquidVariableParent.filters[1].name === 'stylesheet_tag') {
                    const css = liquidVariableParent.expression.value;
                    await checkThemeAssetSize(css, liquidVariableParent.position);
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map