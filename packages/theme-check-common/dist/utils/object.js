"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepGet = deepGet;
function deepGet(obj, path) {
    return path.reduce((acc, key) => acc === null || acc === void 0 ? void 0 : acc[key], obj);
}
//# sourceMappingURL=object.js.map