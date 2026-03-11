"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexBy = indexBy;
/**
 * Returns an Record representation of the collection indexed by keyFn. Assumes
 * the key function returns unique results.
 */
function indexBy(keyFn, collection) {
    const record = {};
    for (const item of collection) {
        record[keyFn(item)] = item;
    }
    return record;
}
//# sourceMappingURL=indexBy.js.map