"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identity = void 0;
exports.unique = unique;
exports.assertNever = assertNever;
exports.unexpected = unexpected;
exports.isString = isString;
exports.extname = extname;
exports.exists = exists;
exports.acceptsLocalBlocks = acceptsLocalBlocks;
function unique(array) {
    return [...new Set(array)];
}
function assertNever(module) {
    throw new Error(`Unknown module type ${module}`);
}
function unexpected() {
    return new Error('Unexpected code path encountered');
}
const identity = (x) => x;
exports.identity = identity;
function isString(x) {
    return typeof x === 'string';
}
function extname(uri) {
    return uri.split('.').pop() || '';
}
async function exists(fs, uri) {
    return fs
        .stat(uri)
        .then(() => true)
        .catch(() => false);
}
async function acceptsLocalBlocks(sectionType, deps) {
    var _a;
    const sectionSchema = await deps.getSectionSchema(sectionType).catch((_) => undefined);
    if (!sectionSchema) {
        return new Error('Section does not exist');
    }
    const validSchema = sectionSchema.validSchema;
    if (validSchema instanceof Error) {
        return validSchema;
    }
    return ((_a = validSchema.blocks) !== null && _a !== void 0 ? _a : []).some((block) => {
        return block.type && 'name' in block && block.name;
    });
}
//# sourceMappingURL=index.js.map