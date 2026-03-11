"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConditionalComment = void 0;
const commentRegex = /(<!--\[if[^\]]*]>)((.|\n)*)(<!\[endif\]-->)$/;
const getConditionalComment = (comment) => {
    const matches = comment.match(commentRegex);
    if (matches) {
        return {
            startTag: matches[1],
            body: matches[2].trim(),
            endTag: matches[4],
        };
    }
};
exports.getConditionalComment = getConditionalComment;
//# sourceMappingURL=conditional-comment.js.map