"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUGMENTATION_PIPELINE = void 0;
const augment_with_css_properties_1 = require("./augment-with-css-properties");
const augment_with_parent_1 = require("./augment-with-parent");
const augment_with_siblings_1 = require("./augment-with-siblings");
const augment_with_whitespace_helpers_1 = require("./augment-with-whitespace-helpers");
const augment_with_family_1 = require("./augment-with-family");
exports.AUGMENTATION_PIPELINE = [
    augment_with_parent_1.augmentWithParent,
    augment_with_siblings_1.augmentWithSiblings,
    augment_with_family_1.augmentWithFamily,
    augment_with_css_properties_1.augmentWithCSSProperties,
    augment_with_whitespace_helpers_1.augmentWithWhitespaceHelpers,
];
//# sourceMappingURL=index.js.map