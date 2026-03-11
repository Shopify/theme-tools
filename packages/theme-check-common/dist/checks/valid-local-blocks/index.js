"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidLocalBlocks = void 0;
const types_1 = require("../../types");
const json_1 = require("../../json");
const to_schema_1 = require("../../to-schema");
const to_schema_2 = require("../../to-schema");
const valid_block_utils_1 = require("./valid-block-utils");
exports.ValidLocalBlocks = {
    meta: {
        code: 'ValidLocalBlocks',
        name: 'Prevent mixing static and local blocks in non-theme sections',
        docs: {
            description: 'Ensures sections without theme block support do not mix static and local blocks',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-local-blocks',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async LiquidRawTag(node) {
                if (node.name !== 'schema' || node.body.kind !== 'json')
                    return;
                const offset = node.blockStartPosition.end;
                const schema = await (0, to_schema_1.getSchema)(context);
                const { validSchema, ast } = schema !== null && schema !== void 0 ? schema : {};
                if (!validSchema || validSchema instanceof Error)
                    return;
                if (!ast || ast instanceof Error)
                    return;
                if (!schema)
                    return;
                const { staticBlockLocations, localBlockLocations, themeBlockLocations, hasRootLevelThemeBlocks, } = (0, valid_block_utils_1.getBlocks)(validSchema);
                if ((0, to_schema_2.isSection)(context.file.uri)) {
                    if (staticBlockLocations.length > 0 && localBlockLocations.length > 0) {
                        staticBlockLocations.forEach((blockWithPath) => {
                            const astNode = (0, json_1.nodeAtPath)(ast, blockWithPath.path);
                            (0, valid_block_utils_1.reportWarning)(`Sections cannot use static theme blocks together with locally scoped blocks.`, offset, astNode, context);
                        });
                    }
                    if (hasRootLevelThemeBlocks &&
                        localBlockLocations.length > 0 &&
                        themeBlockLocations.length > 0) {
                        localBlockLocations.forEach((blockWithPath) => {
                            const astNode = (0, json_1.nodeAtPath)(ast, blockWithPath.path);
                            (0, valid_block_utils_1.reportWarning)('Sections cannot use theme blocks together with locally scoped blocks.', offset, astNode, context);
                        });
                    }
                }
                if ((0, to_schema_2.isBlock)(context.file.uri)) {
                    if (localBlockLocations.length > 0) {
                        localBlockLocations.forEach((blockWithPath) => {
                            const astNode = (0, json_1.nodeAtPath)(ast, blockWithPath.path);
                            (0, valid_block_utils_1.reportWarning)('Local scoped blocks are not supported in theme blocks.', offset, astNode, context);
                        });
                    }
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map