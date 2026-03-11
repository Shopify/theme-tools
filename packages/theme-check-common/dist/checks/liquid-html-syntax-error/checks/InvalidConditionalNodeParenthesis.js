"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectConditionalNodeUnsupportedParenthesis = detectConditionalNodeUnsupportedParenthesis;
const utils_1 = require("./utils");
function detectConditionalNodeUnsupportedParenthesis(node) {
    if (!['if', 'elsif', 'unless'].includes(node.name))
        return;
    if (typeof node.markup !== 'string' || !node.markup.trim())
        return;
    const markupIndex = node.source.indexOf(node.markup, node.position.start);
    const fragments = (0, utils_1.getFragmentsInMarkup)(node.markup);
    const badFragments = fragments.filter((fragment) => (0, utils_1.doesFragmentContainUnsupportedParentheses)(fragment.value));
    if (badFragments.length) {
        return {
            message: utils_1.INVALID_SYNTAX_MESSAGE,
            startIndex: markupIndex,
            endIndex: markupIndex + node.markup.length,
            fix: (corrector) => {
                for (const fragment of badFragments) {
                    corrector.replace(markupIndex + fragment.index, markupIndex + fragment.index + fragment.value.length, fragment.value.replace(/[\(\)]/g, ''));
                }
            },
        };
    }
}
//# sourceMappingURL=InvalidConditionalNodeParenthesis.js.map