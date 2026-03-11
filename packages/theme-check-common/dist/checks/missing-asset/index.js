"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingAsset = void 0;
const types_1 = require("../../types");
const file_utils_1 = require("../../utils/file-utils");
const utils_1 = require("../utils");
exports.MissingAsset = {
    meta: {
        code: 'MissingAsset',
        name: 'Avoid rendering missing asset files',
        docs: {
            description: 'Reports missing asset files',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-asset',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async LiquidVariable(node) {
                if (node.filters.length === 0 || node.filters[0].name !== 'asset_url') {
                    return;
                }
                if (!(0, utils_1.isLiquidString)(node.expression))
                    return;
                let expression = node.expression;
                let originalAssetPath = `assets/${expression.value}`;
                let assetPath = originalAssetPath;
                let fileExists = await (0, file_utils_1.doesFileExist)(context, assetPath);
                if (fileExists)
                    return;
                if (assetPath.endsWith('.scss.css')) {
                    assetPath = assetPath.replace('.scss.css', '.scss.liquid');
                    fileExists = await (0, file_utils_1.doesFileExist)(context, assetPath);
                    if (fileExists)
                        return;
                }
                if (assetPath.endsWith('.js') || assetPath.endsWith('.css')) {
                    assetPath += '.liquid';
                    fileExists = await (0, file_utils_1.doesFileExist)(context, assetPath);
                    if (fileExists)
                        return;
                }
                context.report({
                    message: `'${originalAssetPath}' does not exist`,
                    startIndex: expression.position.start,
                    endIndex: expression.position.end,
                });
            },
        };
    },
};
//# sourceMappingURL=index.js.map