"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.first = first;
exports.last = last;
exports.findLast = findLast;
exports.findLastIndex = findLastIndex;
exports.findLastAndIndex = findLastAndIndex;
function first(arr) {
    return arr[0];
}
function last(arr, offset = 0) {
    return arr[arr.length - 1 + offset];
}
function findLast(array, pred) {
    return array[findLastIndex(array, pred)];
}
function findLastIndex(array, pred) {
    for (let i = array.length - 1; i >= 0; i--) {
        if (pred(array[i]))
            return i;
    }
    return -1;
}
function findLastAndIndex(array, pred) {
    const index = findLastIndex(array, pred);
    return [array[index], index];
}
//# sourceMappingURL=array.js.map