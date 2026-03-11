"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlocks = getBlocks;
exports.isInvalidPresetBlock = isInvalidPresetBlock;
exports.isInvalidDefaultBlock = isInvalidDefaultBlock;
exports.validateNestedBlocks = validateNestedBlocks;
exports.reportWarning = reportWarning;
exports.validateBlockFileExistence = validateBlockFileExistence;
const json_1 = require("../json");
const file_utils_1 = require("./file-utils");
function getBlocks(validSchema) {
    var _a, _b;
    const rootLevelThemeBlocks = [];
    const rootLevelLocalBlocks = [];
    const presetLevelBlocks = {};
    const defaultLevelBlocks = [];
    const rootLevelBlocks = validSchema.blocks;
    const presets = validSchema.presets;
    // Helper function to categorize blocks
    function categorizeRootLevelBlocks(block, index) {
        if (!block)
            return;
        const hasName = 'name' in block;
        if (hasName) {
            rootLevelLocalBlocks.push({
                node: block,
                path: ['blocks', String(index), 'type'],
            });
        }
        else if (block.type !== '@app') {
            rootLevelThemeBlocks.push({
                node: block,
                path: ['blocks', String(index), 'type'],
            });
        }
    }
    function categorizePresetLevelBlocks(block, currentPath, depth = 0) {
        if (!block)
            return;
        if (!presetLevelBlocks[depth]) {
            presetLevelBlocks[depth] = [];
        }
        presetLevelBlocks[depth].push({
            node: block,
            path: currentPath.concat('type'),
        });
        if ('blocks' in block) {
            if (Array.isArray(block.blocks)) {
                block.blocks.forEach((nestedBlock, index) => {
                    categorizePresetLevelBlocks(nestedBlock, currentPath.concat('blocks', String(index)), depth + 1);
                });
            }
            else if (typeof block.blocks === 'object' && block.blocks !== null) {
                Object.entries(block.blocks).forEach(([key, nestedBlock]) => {
                    categorizePresetLevelBlocks(nestedBlock, currentPath.concat('blocks', key), depth + 1);
                });
            }
        }
    }
    function categorizeDefaultLevelBlocks(block, index) {
        const hasName = 'name' in block;
        if (hasName) {
            defaultLevelBlocks.push({
                node: block,
                path: ['default', 'blocks', String(index), 'type'],
            });
        }
    }
    if (Array.isArray(rootLevelBlocks)) {
        rootLevelBlocks.forEach((block, index) => {
            categorizeRootLevelBlocks(block, index);
        });
    }
    if (presets) {
        presets.forEach((preset, presetIndex) => {
            if ('blocks' in preset && preset.blocks) {
                if (Array.isArray(preset.blocks)) {
                    preset.blocks.forEach((block, blockIndex) => {
                        categorizePresetLevelBlocks(block, ['presets', String(presetIndex), 'blocks', String(blockIndex)], 0);
                    });
                }
                else if (typeof preset.blocks === 'object') {
                    Object.entries(preset.blocks).forEach(([key, block]) => {
                        categorizePresetLevelBlocks(block, ['presets', String(presetIndex), 'blocks', key], 0);
                    });
                }
            }
        });
    }
    if ('default' in validSchema) {
        (_b = (_a = validSchema.default) === null || _a === void 0 ? void 0 : _a.blocks) === null || _b === void 0 ? void 0 : _b.forEach((block, index) => {
            categorizeDefaultLevelBlocks(block, index);
        });
    }
    return {
        rootLevelThemeBlocks,
        rootLevelLocalBlocks,
        presetLevelBlocks,
        defaultLevelBlocks,
    };
}
function isInvalidPresetBlock(blockId, blockNode, rootLevelThemeBlocks, staticBlockDefs) {
    if (blockNode.static) {
        return !staticBlockDefs.some((block) => block.type === blockNode.type && block.id === blockId);
    }
    const isPrivateBlockType = blockNode.type.startsWith('_');
    const isThemeInRootLevel = rootLevelThemeBlocks.some((block) => block.node.type === '@theme');
    const needsExplicitRootBlock = isPrivateBlockType || !isThemeInRootLevel;
    const isPresetInRootLevel = rootLevelThemeBlocks.some((block) => block.node.type === blockNode.type);
    return !isPresetInRootLevel && needsExplicitRootBlock;
}
function isInvalidDefaultBlock(blockNode, rootLevelThemeBlocks) {
    const isPrivateBlockType = blockNode.type.startsWith('_');
    const isThemeInRootLevel = rootLevelThemeBlocks.some((block) => block.node.type === '@theme');
    const needsExplicitRootBlock = isPrivateBlockType || !isThemeInRootLevel;
    const isDefaultInRootLevel = rootLevelThemeBlocks.some((block) => block.node.type === blockNode.type);
    return !isDefaultInRootLevel && needsExplicitRootBlock;
}
async function validateBlockTargeting(nestedBlock, nestedPath, context, parentNode, rootLevelThemeBlocks, allowedBlockTypes, offset, ast, staticBlockDefs = []) {
    const typeNode = (0, json_1.nodeAtPath)(ast, nestedPath);
    const blockId = 'id' in nestedBlock ? nestedBlock.id : nestedPath.at(-2);
    if (typeNode) {
        if (isInvalidPresetBlock(blockId, nestedBlock, rootLevelThemeBlocks, staticBlockDefs)) {
            const isStaticBlock = !!nestedBlock.static;
            const isPrivateBlock = nestedBlock.type.startsWith('_');
            const errorMessage = isStaticBlock
                ? `Could not find a static block of type "${nestedBlock.type}" with id "${blockId}" in "blocks/${parentNode.type}.liquid".`
                : isPrivateBlock
                    ? `Private block type "${nestedBlock.type}" is not allowed in "${parentNode.type}" blocks.`
                    : `Block type "${nestedBlock.type}" is not allowed in "${parentNode.type}" blocks. Allowed types are: ${allowedBlockTypes.join(', ')}.`;
            reportWarning(errorMessage, offset, typeNode, context);
        }
        const exists = await validateBlockFileExistence(nestedBlock.type, context);
        if (!exists) {
            reportWarning(`Theme block 'blocks/${nestedBlock.type}.liquid' does not exist.`, offset, typeNode, context);
        }
    }
    if ('blocks' in nestedBlock && nestedBlock.blocks) {
        validateNestedBlocks(context, nestedBlock, nestedBlock.blocks, nestedPath.slice(0, -1), offset, ast);
    }
}
async function validateNestedBlocks(context, parentNode, nestedBlocks, currentPath, offset, ast) {
    var _a;
    if (!nestedBlocks)
        return;
    const parentSchema = await ((_a = context.getBlockSchema) === null || _a === void 0 ? void 0 : _a.call(context, parentNode.type));
    if (!parentSchema || parentSchema instanceof Error)
        return;
    const { validSchema, staticBlockDefs } = parentSchema;
    if (!validSchema || validSchema instanceof Error)
        return;
    const { rootLevelThemeBlocks } = getBlocks(validSchema);
    const allowedBlockTypes = rootLevelThemeBlocks.map((block) => block.node.type);
    if (Array.isArray(nestedBlocks)) {
        Promise.all(nestedBlocks.map((nestedBlock, index) => {
            const nestedPath = currentPath.concat(['blocks', String(index), 'type']);
            return validateBlockTargeting(nestedBlock, nestedPath, context, parentNode, rootLevelThemeBlocks, allowedBlockTypes, offset, ast, staticBlockDefs);
        }));
    }
    else if (typeof nestedBlocks === 'object') {
        Promise.all(Object.entries(nestedBlocks).map(([key, nestedBlock]) => {
            const nestedPath = currentPath.concat(['blocks', key, 'type']);
            return validateBlockTargeting(nestedBlock, nestedPath, context, parentNode, rootLevelThemeBlocks, allowedBlockTypes, offset, ast, staticBlockDefs);
        }));
    }
}
function reportWarning(message, offset, astNode, context) {
    context.report({
        message,
        startIndex: offset + (0, json_1.getLocStart)(astNode),
        endIndex: offset + (0, json_1.getLocEnd)(astNode),
    });
}
async function validateBlockFileExistence(blockType, context) {
    if (blockType === '@theme' || blockType === '@app') {
        return true;
    }
    const blockPath = `blocks/${blockType}.liquid`;
    return await (0, file_utils_1.doesFileExist)(context, blockPath);
}
//# sourceMappingURL=block.js.map