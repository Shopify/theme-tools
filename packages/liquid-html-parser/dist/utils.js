"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNever = assertNever;
exports.locStart = locStart;
exports.locEnd = locEnd;
exports.deepGet = deepGet;
exports.dropLast = dropLast;
function assertNever(x) {
    throw new Error(`Unexpected object: ${x.type}`);
}
function locStart(node) {
    return node.position.start;
}
function locEnd(node) {
    return node.position.end;
}
function deepGet(path, obj) {
    return path.reduce((curr, k) => {
        if (curr && curr[k] !== undefined)
            return curr[k];
        return undefined;
    }, obj);
}
function dropLast(n, xs) {
    const result = [...xs];
    for (let i = 0; i < n; i++) {
        result.pop();
    }
    return result;
}
//# sourceMappingURL=utils.js.map