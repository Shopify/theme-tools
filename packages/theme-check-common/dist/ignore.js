"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIgnored = isIgnored;
const minimatch_1 = require("minimatch");
function isIgnored(uri, config, checkDef) {
    const ignorePatterns = [...checkIgnorePatterns(checkDef, config), ...asArray(config.ignore)].map((pattern) => pattern
        .replace(/^\//, config.rootUri + '/') // "absolute patterns" are config.rootUri matches
        .replace(/^([^\/])/, '**/$1') // "relative patterns" are "**/${pattern}"
        .replace(/\/\*$/, '/**'));
    return ignorePatterns.some((pattern) => (0, minimatch_1.minimatch)(uri, pattern));
}
function checkIgnorePatterns(checkDef, config) {
    var _a;
    if (!checkDef)
        return [];
    return asArray((_a = config.settings[checkDef.meta.code]) === null || _a === void 0 ? void 0 : _a.ignore);
}
function asArray(x) {
    return x !== null && x !== void 0 ? x : [];
}
//# sourceMappingURL=ignore.js.map