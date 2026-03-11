"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetSizeJavaScript = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const file_utils_1 = require("../../utils/file-utils");
const utils_2 = require("../utils");
const schema = {
    thresholdInBytes: types_1.SchemaProp.number(10000),
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
exports.AssetSizeJavaScript = {
    meta: {
        code: 'AssetSizeJavaScript',
        name: 'Prevent Large JavaScript bundles',
        docs: {
            description: 'This check is aimed at preventing large JavaScript bundles for speed.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/asset-size-javascript',
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
                    message: `JavaScript on every page load exceeds compressed size threshold (${thresholdInBytes} Bytes), consider using the import on interaction pattern.`,
                    startIndex: position.start,
                    endIndex: position.end,
                });
            }
        }
        async function checkThemeAssetSize(srcValue, position) {
            if (await (0, file_utils_1.hasLocalAssetSizeExceededThreshold)(context, `assets/${srcValue}`, thresholdInBytes)) {
                context.report({
                    message: `JavaScript on every page load exceeds compressed size threshold (${thresholdInBytes} Bytes), consider using the import on interaction pattern.`,
                    startIndex: position.start,
                    endIndex: position.end,
                });
            }
        }
        return {
            async HtmlRawNode(node) {
                if (node.name !== 'script')
                    return;
                const src = node.attributes
                    .filter(utils_2.isValuedHtmlAttribute)
                    .find((attr) => (0, utils_2.isAttr)(attr, 'src'));
                if (!src)
                    return;
                if (src.value.length !== 1)
                    return;
                if (isTextNode(src.value[0]) && /(https?:)?\/\//.test(src.value[0].value)) {
                    const url = src.value[0].value;
                    await checkRemoteAssetSize(url, src.attributePosition);
                }
                if (isLiquidVariableOutput(src.value[0]) &&
                    isLiquidVariable(src.value[0].markup) &&
                    isString(src.value[0].markup.expression) &&
                    src.value[0].markup.filters.length === 1 &&
                    src.value[0].markup.filters[0].name === 'asset_url') {
                    const assetName = src.value[0].markup.expression.value;
                    await checkThemeAssetSize(assetName, src.attributePosition);
                }
            },
            async LiquidFilter(node, ancestors) {
                if (node.name !== 'script_tag')
                    return;
                const liquidVariableParent = (0, utils_1.last)(ancestors);
                if (!liquidVariableParent || !(0, utils_2.isNodeOfType)(liquid_html_parser_1.NodeTypes.LiquidVariable, liquidVariableParent))
                    return;
                if (liquidVariableParent.expression.type !== liquid_html_parser_1.NodeTypes.String)
                    return;
                if (liquidVariableParent.expression.value[0].length == 1 &&
                    liquidVariableParent.filters.length == 1 &&
                    /(https?:)?\/\//.test(liquidVariableParent.expression.value)) {
                    const url = liquidVariableParent.expression.value;
                    await checkRemoteAssetSize(url, liquidVariableParent.expression.position);
                }
                if (liquidVariableParent.expression.value[0].length == 1 &&
                    liquidVariableParent.filters.length == 2 &&
                    liquidVariableParent.filters[0].name === 'asset_url' &&
                    liquidVariableParent.filters[1].name === 'script_tag') {
                    const js = liquidVariableParent.expression.value;
                    await checkThemeAssetSize(js, liquidVariableParent.position);
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map