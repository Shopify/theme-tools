"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPropertyNode = isPropertyNode;
exports.getAllBlocks = getAllBlocks;
const json_1 = require("../../json");
const file_utils_1 = require("../../utils/file-utils");
function isPropertyNode(node) {
    return typeof node === 'object' && node !== null;
}
function isNestedBlock(currentPath) {
    return currentPath.filter((segment) => segment === 'blocks').length > 1;
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
async function getThemeBlocks(sectionType, currentPath, context) {
    var _a, _b;
    const themeBlocks = [];
    if (!sectionType)
        return themeBlocks;
    const schema = isNestedBlock(currentPath)
        ? await ((_a = context.getBlockSchema) === null || _a === void 0 ? void 0 : _a.call(context, sectionType))
        : await ((_b = context.getSectionSchema) === null || _b === void 0 ? void 0 : _b.call(context, sectionType));
    if (!schema || schema instanceof Error)
        return themeBlocks;
    const { validSchema } = schema;
    if (!validSchema || validSchema instanceof Error)
        return themeBlocks;
    if (Array.isArray(validSchema.blocks)) {
        validSchema.blocks.forEach((block) => {
            if (!('name' in block) && block.type !== '@app') {
                themeBlocks.push(block.type);
            }
        });
    }
    return themeBlocks;
}
async function validateBlock(blockType, blockStatic, blockPath, ancestorType, currentPath, offset, context) {
    const themeBlocks = await getThemeBlocks(ancestorType, currentPath, context);
    if (themeBlocks.length === 0)
        return;
    const exists = await validateBlockFileExistence(blockType, context);
    if (!exists) {
        reportWarning(`Theme block 'blocks/${blockType}.liquid' does not exist.`, offset, blockPath, context);
    }
    else if (blockStatic) {
        // Static blocks are not required to be in the schema blocks array
        return;
    }
    else {
        const isPrivateBlock = blockType.startsWith('_');
        const schemaIncludesAtTheme = themeBlocks.includes('@theme');
        const schemaIncludesBlockType = themeBlocks.includes(blockType);
        if (!isPrivateBlock ? schemaIncludesBlockType || schemaIncludesAtTheme : schemaIncludesBlockType) {
            return;
        }
        else {
            const location = isNestedBlock(currentPath) ? 'blocks' : 'sections';
            reportWarning(`Block type '${blockType}' is not allowed in '${location}/${ancestorType}.liquid'.`, offset, blockPath, context);
        }
    }
}
async function getAllBlocks(ast, offset, ancestorType, blocks, currentPath, context) {
    await Promise.all(Object.entries(blocks).map(async ([blockKey, block]) => {
        if (block.type) {
            const typePath = currentPath.concat(blockKey, 'type');
            const blockPath = (0, json_1.nodeAtPath)(ast, typePath);
            if (blockPath) {
                await validateBlock(block.type, block.static, blockPath, ancestorType, currentPath, offset, context);
            }
        }
        if ('blocks' in block) {
            await getAllBlocks(ast, offset, block.type, block.blocks, currentPath.concat(blockKey, 'blocks'), context);
        }
    }));
}
//# sourceMappingURL=missing-block-utils.js.map