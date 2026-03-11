"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlocks = getBlocks;
exports.reportWarning = reportWarning;
const json_1 = require("../../json");
function getBlocks(validSchema) {
    const staticBlockLocations = [];
    const localBlockLocations = [];
    const themeBlockLocations = [];
    const rootLevelBlocks = validSchema.blocks;
    const presets = validSchema.presets;
    function categorizeBlock(block, currentPath, inPreset = false) {
        if (!block)
            return;
        const hasStatic = 'static' in block;
        const hasName = 'name' in block;
        if (hasStatic) {
            staticBlockLocations.push({ node: block, path: currentPath.concat('type') });
        }
        else if (hasName && !inPreset) {
            localBlockLocations.push({ node: block, path: currentPath.concat('type') });
        }
        else if (block.type !== '@app') {
            themeBlockLocations.push({ node: block, path: currentPath.concat('type') });
        }
        if ('blocks' in block) {
            if (Array.isArray(block.blocks)) {
                block.blocks.forEach((nestedBlock, index) => {
                    categorizeBlock(nestedBlock, currentPath.concat('blocks', String(index)), inPreset);
                });
            }
            else if (typeof block.blocks === 'object' && block.blocks !== null) {
                Object.entries(block.blocks).forEach(([key, nestedBlock]) => {
                    categorizeBlock(nestedBlock, currentPath.concat('blocks', key), inPreset);
                });
            }
        }
    }
    if (Array.isArray(rootLevelBlocks)) {
        rootLevelBlocks.forEach((block, index) => {
            categorizeBlock(block, ['blocks', String(index)]);
        });
    }
    if (presets) {
        presets.forEach((preset, presetIndex) => {
            if ('blocks' in preset && preset.blocks) {
                if (Array.isArray(preset.blocks)) {
                    preset.blocks.forEach((block, blockIndex) => {
                        categorizeBlock(block, ['presets', String(presetIndex), 'blocks', String(blockIndex)], true);
                    });
                }
                else if (typeof preset.blocks === 'object') {
                    Object.entries(preset.blocks).forEach(([key, block]) => {
                        categorizeBlock(block, ['presets', String(presetIndex), 'blocks', key], true);
                    });
                }
            }
        });
    }
    return {
        staticBlockLocations,
        localBlockLocations,
        themeBlockLocations,
        hasRootLevelThemeBlocks: themeBlockLocations.some((block) => block.path[0] === 'blocks'),
    };
}
function reportWarning(message, offset, astNode, context) {
    context.report({
        message,
        startIndex: offset + (0, json_1.getLocStart)(astNode),
        endIndex: offset + (0, json_1.getLocEnd)(astNode),
    });
}
//# sourceMappingURL=valid-block-utils.js.map