"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetSizeAppBlockJavaScript = void 0;
const json_1 = require("../../json");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const file_utils_1 = require("../../utils/file-utils");
const schema = {
    thresholdInBytes: types_1.SchemaProp.number(10000),
};
exports.AssetSizeAppBlockJavaScript = {
    meta: {
        code: 'AssetSizeAppBlockJavaScript',
        name: 'Asset Size App Block JavaScript',
        docs: {
            description: 'This check is aimed at preventing large JavaScript bundles from being included via Theme App Extensions.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/asset-size-app-block-javascript',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema,
        targets: [types_1.ConfigTarget.ThemeAppExtension],
    },
    create(context) {
        if (!context.fileSize) {
            return {};
        }
        return {
            async LiquidRawTag(node) {
                if (node.name !== 'schema')
                    return;
                const schema = (0, json_1.parseJSON)(node.body.value);
                if ((0, utils_1.isError)(schema))
                    return;
                const javascript = schema.javascript;
                if (!javascript)
                    return;
                const relativePath = `assets/${javascript}`;
                const thresholdInBytes = context.settings.thresholdInBytes;
                const startIndex = node.body.position.start + node.body.value.indexOf(javascript);
                const endIndex = startIndex + javascript.length;
                const fileExists = await (0, file_utils_1.doesFileExist)(context, relativePath);
                if (!fileExists) {
                    context.report({
                        message: `'${javascript}' does not exist.`,
                        startIndex: startIndex,
                        endIndex: endIndex,
                    });
                    return;
                }
                const [fileExceedsThreshold, fileSize] = await (0, file_utils_1.doesFileExceedThreshold)(context, relativePath, thresholdInBytes);
                if (fileExceedsThreshold) {
                    context.report({
                        message: `The file size for '${javascript}' (${fileSize} B) exceeds the configured threshold (${thresholdInBytes} B)`,
                        startIndex: startIndex,
                        endIndex: endIndex,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map