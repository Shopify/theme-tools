"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentWithSiblings = void 0;
exports.prev = prev;
exports.next = next;
const types_1 = require("../../types");
function prev(node) {
    if (!node.parentNode)
        return;
    const collection = parentCollection(node);
    return collection[collection.indexOf(node) - 1];
}
function next(node) {
    if (!node.parentNode)
        return;
    const collection = parentCollection(node);
    return collection[collection.indexOf(node) + 1];
}
function parentCollection(node) {
    if (!node.parentNode) {
        return [];
    }
    for (const key of Object.keys(node.parentNode)) {
        // can't figure out the typing for this and I am done wasting my time.
        const parentValue = node.parentNode[key];
        if (Array.isArray(parentValue)) {
            if (parentValue.indexOf(node) !== -1) {
                return parentValue;
            }
        }
        if ((0, types_1.isLiquidHtmlNode)(parentValue) && parentValue === node) {
            return [];
        }
    }
    throw new Error('Could not find parent collection of node');
}
const augmentWithSiblings = (_options, node) => {
    const augmentations = {
        next: next(node),
        prev: prev(node),
    };
    Object.assign(node, augmentations);
};
exports.augmentWithSiblings = augmentWithSiblings;
//# sourceMappingURL=augment-with-siblings.js.map