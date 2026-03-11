"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInvalidBooleanExpressions = detectInvalidBooleanExpressions;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("./utils");
const utils_2 = require("../../utils");
function detectInvalidBooleanExpressions(node, ancestors) {
    if ((0, utils_2.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
        return;
    const condition = node.condition;
    if (condition.type !== liquid_html_parser_1.NodeTypes.Comparison && condition.type !== liquid_html_parser_1.NodeTypes.LogicalExpression) {
        return;
    }
    return {
        message: utils_1.INVALID_SYNTAX_MESSAGE,
        startIndex: node.position.start,
        endIndex: node.position.end,
        fix: (corrector) => {
            corrector.replace(node.position.start, node.position.end, node.source.slice(condition.left.position.start, condition.left.position.end));
        },
    };
}
//# sourceMappingURL=InvalidBooleanExpressions.js.map