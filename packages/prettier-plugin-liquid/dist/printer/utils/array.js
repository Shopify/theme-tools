"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.last = last;
exports.first = first;
exports.intersperse = intersperse;
exports.isEmpty = isEmpty;
function last(x) {
    return x[x.length - 1];
}
function first(x) {
    return x[0];
}
function intersperse(array, delim) {
    return array.flatMap((val) => [delim, val]).slice(1);
}
function isEmpty(col) {
    return col.length === 0;
}
//# sourceMappingURL=array.js.map