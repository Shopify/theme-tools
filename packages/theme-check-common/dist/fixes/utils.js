"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenFixes = flattenFixes;
function flattenFixes(fix) {
    if (!Array.isArray(fix))
        return [fix];
    return fix.flatMap(flattenFixes);
}
//# sourceMappingURL=utils.js.map