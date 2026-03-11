"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVALID_SYNTAX_MESSAGE = void 0;
exports.getValuesInMarkup = getValuesInMarkup;
exports.getFragmentsInMarkup = getFragmentsInMarkup;
exports.getRangeMatch = getRangeMatch;
exports.doesFragmentContainUnsupportedParentheses = doesFragmentContainUnsupportedParentheses;
exports.fragmentKeyValuePair = fragmentKeyValuePair;
exports.INVALID_SYNTAX_MESSAGE = 'Syntax is not supported';
function getValuesInMarkup(markup) {
    return [...markup.matchAll(new RegExp(VALUE_PATTERN, 'g'))].map((match) => ({
        value: match[0],
        index: match.index,
    }));
}
const DOUBLE_QUOTED_STRING = `"[^"]*"`;
const SINGLE_QUOTED_STRING = `'[^']*'`;
// Lax parser does NOT complain about leading/trailing spaces inside ranges (e.g. `(1 .. 10 )`) and
// within the parenthesis (e.g. `( 1 .. 10 )`), but fails to render the liquid when using the gem.
// Strict parser does NOT complain, but still renders it.
// To avoid any issues, we will remove extra spaces.
const RANGE_MARKUP_COMPONENT_REGEX = `\\s*(-?\\d+(?:\\.\\d+)?|\\w+(?:\\.\\w+)*)\\s*`;
const RANGE_MARKUP_REGEX = `\\(\\s*${RANGE_MARKUP_COMPONENT_REGEX}(\\.{2,})\\s*${RANGE_MARKUP_COMPONENT_REGEX}\\s*\\)`;
const REGULAR_TOKEN = `[^\\s,]+`; // tokens separated by commas or spaces
// Quoted strings pattern (combination of double and single quoted)
const QUOTED_STRING = `(${DOUBLE_QUOTED_STRING}|${SINGLE_QUOTED_STRING})`;
// Value pattern for key-value pairs (can be quoted, parenthesized, or regular token)
const VALUE_PATTERN = `(${QUOTED_STRING}|${RANGE_MARKUP_REGEX}|${REGULAR_TOKEN})`;
// Key-value pair pattern
const KEY_VALUE_PAIR = `(\\S+):\\s*${VALUE_PATTERN}`;
const MARKUP_FRAGMENTS_PATTERN = new RegExp(`${QUOTED_STRING}|${RANGE_MARKUP_REGEX}|${KEY_VALUE_PAIR}|${REGULAR_TOKEN}`, 'g');
function getFragmentsInMarkup(markup) {
    return [...markup.matchAll(MARKUP_FRAGMENTS_PATTERN)].map((match) => ({
        value: match[0],
        index: match.index,
    }));
}
function getRangeMatch(markup) {
    return markup.match(RANGE_MARKUP_REGEX);
}
function doesFragmentContainUnsupportedParentheses(fragment) {
    if (getRangeMatch(fragment)) {
        return false;
    }
    return fragment.includes('(') || fragment.includes(')');
}
function fragmentKeyValuePair(fragment) {
    const match = fragment.match(new RegExp(KEY_VALUE_PAIR));
    if (!match) {
        return;
    }
    const [, key, value] = match;
    return {
        key,
        value,
    };
}
//# sourceMappingURL=utils.js.map