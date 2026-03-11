"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVALID_LOOP_RANGE_MESSAGE = void 0;
exports.detectInvalidLoopRange = detectInvalidLoopRange;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("./utils");
const utils_2 = require("../../utils");
exports.INVALID_LOOP_RANGE_MESSAGE = 'Ranges must be in the format `(<start>..<end>)`. The start and end of the range must be whole numbers or variables.';
function detectInvalidLoopRange(node) {
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidTag && !(0, utils_2.isLoopLiquidTag)(node)) {
        return;
    }
    const markup = node.markup;
    if (!markup) {
        return;
    }
    if (typeof markup === 'string') {
        return validateMarkup(node, markup);
    }
    if (markup.collection.type === liquid_html_parser_1.NodeTypes.Range) {
        return validateMarkup(node, node.source.slice(markup.collection.position.start, markup.collection.position.end));
    }
}
function validateMarkup(node, markup) {
    const match = (0, utils_1.getRangeMatch)(markup);
    if (!match || match.index === undefined) {
        return;
    }
    const [fullMatch, start, , end] = match;
    let startCleaned = start;
    let endCleaned = end;
    if (!isNaN(Number(start)) && Number(start) % 1 !== 0) {
        startCleaned = `${Math.trunc(Number(start))}`;
    }
    if (!isNaN(Number(end)) && Number(end) % 1 !== 0) {
        endCleaned = `${Math.trunc(Number(end))}`;
    }
    const expectedRangeMarkup = `(${startCleaned}..${endCleaned})`;
    if (markup.slice(match.index, match.index + fullMatch.length) === expectedRangeMarkup) {
        return;
    }
    const markupIndex = node.source.indexOf(markup, node.position.start);
    const startIndex = markupIndex + match.index;
    const endIndex = startIndex + fullMatch.length;
    return {
        message: exports.INVALID_LOOP_RANGE_MESSAGE,
        startIndex,
        endIndex,
        fix: (corrector) => {
            corrector.replace(startIndex, endIndex, expectedRangeMarkup);
        },
    };
}
//# sourceMappingURL=InvalidLoopRange.js.map