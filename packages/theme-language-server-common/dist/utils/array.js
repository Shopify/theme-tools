"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLast = findLast;
// Array.prototype.findLast is only available in es2023. Which feels too new?
function findLast(array, pred) {
    for (let i = array.length - 1; i >= 0; i--) {
        if (pred(array[i]))
            return array[i];
    }
}
//# sourceMappingURL=array.js.map