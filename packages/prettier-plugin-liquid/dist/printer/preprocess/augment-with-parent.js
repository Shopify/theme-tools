"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentWithParent = void 0;
const augmentWithParent = (_options, node, parentNode) => {
    const augmentations = {
        parentNode: parentNode,
    };
    Object.assign(node, augmentations);
    // Adding lazy property for debugging. Not added to the
    // types so that we don't use it officially.
    Object.defineProperty(node, '_rawSource', {
        get() {
            return this.source.slice(this.position.start, this.position.end);
        },
    });
};
exports.augmentWithParent = augmentWithParent;
//# sourceMappingURL=augment-with-parent.js.map