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
exports.getConditionalComment = exports.BLOCKS = exports.VOID_ELEMENTS = exports.RAW_TAGS = exports.TAGS_WITHOUT_MARKUP = void 0;
__exportStar(require("./stage-2-ast"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./errors"), exports);
var grammar_1 = require("./grammar");
Object.defineProperty(exports, "TAGS_WITHOUT_MARKUP", { enumerable: true, get: function () { return grammar_1.TAGS_WITHOUT_MARKUP; } });
Object.defineProperty(exports, "RAW_TAGS", { enumerable: true, get: function () { return grammar_1.RAW_TAGS; } });
Object.defineProperty(exports, "VOID_ELEMENTS", { enumerable: true, get: function () { return grammar_1.VOID_ELEMENTS; } });
Object.defineProperty(exports, "BLOCKS", { enumerable: true, get: function () { return grammar_1.BLOCKS; } });
var conditional_comment_1 = require("./conditional-comment");
Object.defineProperty(exports, "getConditionalComment", { enumerable: true, get: function () { return conditional_comment_1.getConditionalComment; } });
//# sourceMappingURL=index.js.map