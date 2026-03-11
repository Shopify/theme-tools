"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentWithFamily = void 0;
const augmentWithFamily = (_options, node) => {
    const children = node.children || [];
    const augmentations = {
        firstChild: children[0],
        lastChild: children[children.length - 1],
    };
    Object.assign(node, augmentations);
};
exports.augmentWithFamily = augmentWithFamily;
//# sourceMappingURL=augment-with-family.js.map