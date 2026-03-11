"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCovered = isCovered;
function isCovered(offset, range) {
    return range.start <= offset && offset <= range.end;
}
//# sourceMappingURL=isCovered.js.map