"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containOffense = void 0;
const containOffense = function (offenses, expected) {
    const { isNot, equals } = this;
    const isExpectingString = typeof expected === 'string';
    if (isExpectingString) {
        const containsMessage = offenses.some((offense) => offense.message === expected);
        return {
            pass: containsMessage,
            message: () => `expected offenses to ${isNot ? 'not ' : ''}contain offense with message ${expected}`,
            actual: offenses.map((offense) => offense.message),
            expected: [expected],
        };
    }
    // Verify that the offenses contains an offense with the subset of expected keys specified.
    const containsOffense = offenses.some((offense) => {
        // For each offense, we need to systematically check each expected value satisfies the value in the actual offense.
        return Object.entries(expected).every(([expectedKey, expectedValue]) => {
            if (expectedKey in offense) {
                // @ts-ignore - typescript doesn't like dynamic key traversal
                const actualValue = offense[expectedKey];
                return equals(actualValue, expectedValue);
            }
            return false;
        });
    });
    return {
        pass: containsOffense,
        message: () => `expected offenses to${isNot ? ' not' : ''} include the specified offense`,
        actual: offenses,
        expected: expected,
    };
};
exports.containOffense = containOffense;
//# sourceMappingURL=contain-offense.js.map