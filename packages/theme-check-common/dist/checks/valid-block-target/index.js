"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidBlockTarget = void 0;
const json_1 = require("../../json");
const to_schema_1 = require("../../to-schema");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
exports.ValidBlockTarget = {
    meta: {
        code: 'ValidBlockTarget',
        name: 'Validate block targeting in presets',
        docs: {
            description: 'Ensures block types only reference valid block types and respect parent-child relationships',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-target',
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
                const { staticBlockDefs } = schema;
                const { rootLevelThemeBlocks, rootLevelLocalBlocks, presetLevelBlocks, defaultLevelBlocks, } = (0, utils_1.getBlocks)(validSchema);
                if (rootLevelLocalBlocks.length > 0)
                    return;
                let errorsInRootLevelBlocks = false;
                await Promise.all(rootLevelThemeBlocks.map(async ({ node, path }) => {
                    const typeNode = (0, json_1.nodeAtPath)(ast, path);
                    const exists = await (0, utils_1.validateBlockFileExistence)(node.type, context);
                    if (!exists) {
                        errorsInRootLevelBlocks = true;
                        (0, utils_1.reportWarning)(blockDoesNotExistError(node.type), offset, typeNode, context);
                    }
                }));
                if (errorsInRootLevelBlocks)
                    return;
                for (const [depthStr, blocks] of Object.entries(presetLevelBlocks)) {
                    const depth = parseInt(depthStr, 10);
                    if (depth === 0) {
                        await Promise.all(blocks.map(async ({ node, path }) => {
                            const typeNode = (0, json_1.nodeAtPath)(ast, path);
                            const blockId = 'id' in node ? node.id : path.at(-2);
                            const isStaticBlock = !!node.static;
                            if ((0, utils_1.isInvalidPresetBlock)(blockId, node, rootLevelThemeBlocks, staticBlockDefs)) {
                                const errorMessage = isStaticBlock
                                    ? `Could not find a static block of type "${node.type}" with id "${blockId}" in this file.`
                                    : reportMissingThemeBlockDefinitionError(node);
                                (0, utils_1.reportWarning)(errorMessage, offset, typeNode, context);
                            }
                            const exists = await (0, utils_1.validateBlockFileExistence)(node.type, context);
                            if (exists) {
                                if ('blocks' in node && node.blocks) {
                                    await (0, utils_1.validateNestedBlocks)(context, node, node.blocks, path.slice(0, -1), offset, ast);
                                }
                            }
                            else {
                                (0, utils_1.reportWarning)(blockDoesNotExistError(node.type), offset, typeNode, context);
                            }
                        }));
                    }
                }
                await Promise.all(defaultLevelBlocks.map(async ({ node, path }) => {
                    const typeNode = (0, json_1.nodeAtPath)(ast, path);
                    if ((0, utils_1.isInvalidDefaultBlock)(node, rootLevelThemeBlocks)) {
                        (0, utils_1.reportWarning)(reportMissingThemeBlockDefinitionError(node), offset, typeNode, context);
                    }
                    const exists = await (0, utils_1.validateBlockFileExistence)(node.type, context);
                    if (!exists) {
                        (0, utils_1.reportWarning)(blockDoesNotExistError(node.type), offset, typeNode, context);
                    }
                }));
            },
        };
    },
};
function reportMissingThemeBlockDefinitionError(node) {
    const isPrivateBlockType = node.type.startsWith('_');
    return isPrivateBlockType
        ? `Theme block type "${node.type}" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.`
        : `Theme block type "${node.type}" must be allowed in "blocks" at the root of this schema.`;
}
function blockDoesNotExistError(name) {
    return `Theme block 'blocks/${name}.liquid' does not exist.`;
}
//# sourceMappingURL=index.js.map