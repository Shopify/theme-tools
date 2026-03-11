"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInvalidEchoValue = detectInvalidEchoValue;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("./utils");
function detectInvalidEchoValue(node) {
    var _a;
    // We've broken it up into two groups:
    // 1. The variable(s)
    // 2. The filter section (non-captured)
    const ECHO_MARKUP_REGEX = /([^|]*)(?:\s*\|\s*.*)?$/m;
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidTag && node.name !== 'echo') {
        return;
    }
    const markup = node.markup;
    if (typeof markup !== 'string' ||
        // echo tags and variable outputs without markup are strict-valid:
        // e.g. {{ }}, {% echo %}, and {% liquid echo %}
        !markup) {
        return;
    }
    const match = markup.match(ECHO_MARKUP_REGEX);
    if (!match) {
        return;
    }
    const [, echoValue] = match;
    const firstEchoValue = (_a = (0, utils_1.getValuesInMarkup)(echoValue).at(0)) === null || _a === void 0 ? void 0 : _a.value;
    if (!firstEchoValue) {
        const startIndex = node.source.indexOf(markup, node.position.start);
        const endIndex = startIndex + markup.length;
        return {
            message: utils_1.INVALID_SYNTAX_MESSAGE,
            startIndex,
            endIndex,
            fix: (corrector) => {
                corrector.replace(startIndex, endIndex, 'blank');
            },
        };
    }
    const removalIndices = (source, startingIndex) => {
        const offset = source.indexOf(markup, startingIndex);
        return {
            startIndex: offset + firstEchoValue.length,
            endIndex: offset + echoValue.trimEnd().length,
        };
    };
    const { startIndex, endIndex } = removalIndices(node.source, node.position.start);
    if (endIndex <= startIndex) {
        return;
    }
    return {
        message: utils_1.INVALID_SYNTAX_MESSAGE,
        startIndex,
        endIndex,
        fix: (corrector) => {
            corrector.replace(startIndex, endIndex, '');
        },
    };
}
//# sourceMappingURL=InvalidEchoValue.js.map