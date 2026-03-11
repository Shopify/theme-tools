"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORCE_BREAK_GROUP_ID = exports.FORCE_FLAT_GROUP_ID = void 0;
exports.getSource = getSource;
exports.isDeeplyNested = isDeeplyNested;
exports.getWhitespaceTrim = getWhitespaceTrim;
exports.ifBreakChain = ifBreakChain;
exports.isNonEmptyArray = isNonEmptyArray;
const prettier_1 = require("prettier");
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const array_1 = require("./array");
__exportStar(require("./array"), exports);
__exportStar(require("./string"), exports);
__exportStar(require("./node"), exports);
const { builders } = prettier_1.doc;
const { ifBreak } = builders;
function getSource(path) {
    return path.getValue().source;
}
function isDeeplyNested(node) {
    if (!node.children)
        return false;
    if ((0, liquid_html_parser_1.isBranchedTag)(node)) {
        return !!node.children.find((child) => isDeeplyNested(child));
    }
    return !!node.children.find((child) => !(0, array_1.isEmpty)(child.children || []));
}
// Optionally converts a '' into '-' if any of the parent group breaks and source[loc] is non space.
function getWhitespaceTrim(currWhitespaceTrim, needsWhitespaceStrippingOnBreak, groupIds) {
    return ifBreakChain(needsWhitespaceStrippingOnBreak ? '-' : currWhitespaceTrim, currWhitespaceTrim, Array.isArray(groupIds) ? groupIds : [groupIds]);
}
// Threads ifBreak into multiple sources of breakage (paragraph or self, etc.)
exports.FORCE_FLAT_GROUP_ID = Symbol('force-no-break');
exports.FORCE_BREAK_GROUP_ID = Symbol('force-break');
function ifBreakChain(breaksContent, flatContent, groupIds) {
    if (groupIds.includes(exports.FORCE_BREAK_GROUP_ID))
        return breaksContent;
    if (groupIds.includes(exports.FORCE_FLAT_GROUP_ID))
        return flatContent;
    return groupIds.reduce((currFlatContent, groupId) => ifBreak(breaksContent, currFlatContent, { groupId }), flatContent);
}
function isNonEmptyArray(object) {
    return Array.isArray(object) && object.length > 0;
}
//# sourceMappingURL=index.js.map