"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInvalidLoopArguments = detectInvalidLoopArguments;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("./utils");
const utils_2 = require("../../utils");
function detectInvalidLoopArguments(node, tags = []) {
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidTag && !(0, utils_2.isLoopLiquidTag)(node)) {
        return;
    }
    let markup = node.markup;
    if (!markup) {
        return;
    }
    if (typeof markup !== 'string') {
        markup = markup.source.slice(markup.position.start, markup.position.end);
    }
    const fragments = (0, utils_1.getFragmentsInMarkup)(markup);
    // The first three fragments are: `<variable> in <array>`
    // If they haven't started typing the tag, we don't want to report an error.
    if (fragments.length <= 3) {
        return;
    }
    const markupIndex = node.source.indexOf(markup, node.position.start);
    let startIndex = markupIndex + fragments.at(3).index;
    let endIndex = markupIndex + fragments.at(-1).index + fragments.at(-1).value.length;
    const filteredFragments = [];
    // Positional arguments are ignored if they come after invalid positional args or named args
    let noMorePositionalArguments = false;
    const invalidFragments = [];
    for (let i = 3; i < fragments.length; i++) {
        const fragment = fragments[i];
        if ((0, utils_1.doesFragmentContainUnsupportedParentheses)(fragment.value)) {
            noMorePositionalArguments = true;
            invalidFragments.push(fragment.value);
            continue;
        }
        const keyValuePair = (0, utils_1.fragmentKeyValuePair)(fragment.value);
        // Named arg is found
        if (keyValuePair) {
            noMorePositionalArguments = true;
            if (!isSupportedTagArgument(tags, node.name, keyValuePair.key, false)) {
                invalidFragments.push(fragment.value);
                continue;
            }
        }
        // Unsupported positional arg is found
        else if (noMorePositionalArguments ||
            !isSupportedTagArgument(tags, node.name, fragment.value, true)) {
            noMorePositionalArguments = true;
            invalidFragments.push(fragment.value);
            continue;
        }
        filteredFragments.push(fragment.value);
    }
    if (invalidFragments.length === 0) {
        return;
    }
    return {
        message: `Arguments must be provided in the format \`${node.name} in <array> <positional arguments> <named arguments>\`. Invalid/Unknown arguments: ${invalidFragments.join(', ')}`,
        startIndex,
        endIndex,
        fix: (corrector) => {
            corrector.replace(startIndex, endIndex, filteredFragments.join(' '));
        },
    };
}
function isSupportedTagArgument(tags, tagName, key, positional) {
    var _a, _b;
    return (((_b = (_a = tags
        .find((tag) => tag.name === tagName)) === null || _a === void 0 ? void 0 : _a.parameters) === null || _b === void 0 ? void 0 : _b.some((parameter) => parameter.name === key && parameter.positional === positional)) || false);
}
//# sourceMappingURL=InvalidLoopArguments.js.map