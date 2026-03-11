"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuggestAssertion = void 0;
const vitest_1 = require("vitest");
const fixes_1 = require("../fixes");
const { util } = vitest_1.chai;
exports.SuggestAssertion = {
    name: 'suggest',
    fn: function (...args) {
        var _a;
        const offense = this._obj;
        const source = args.at(0);
        const expectedMessage = args.at(1);
        const expectedFix = args.at(2);
        const suggestions = (_a = offense.suggest) === null || _a === void 0 ? void 0 : _a.map((suggestion) => {
            const corrector = (0, fixes_1.createCorrector)(offense.type, source);
            suggestion.fix(corrector);
            return {
                message: suggestion.message,
                fix: (0, fixes_1.flattenFixes)(corrector.fix),
            };
        });
        const hasSuggestion = !!(suggestions === null || suggestions === void 0 ? void 0 : suggestions.some((appliedSuggestion) => util.eql(appliedSuggestion.message, expectedMessage) &&
            (!expectedFix || util.eql(appliedSuggestion.fix, (0, fixes_1.flattenFixes)(expectedFix)))));
        const ok = !!offense.suggest && offense.suggest.length > 0 && hasSuggestion;
        const expectedAppliedSuggestion = { message: expectedMessage, fix: [expectedFix] };
        this.assert(ok, `expected ${util.inspect(suggestions)} to include ${util.inspect(expectedAppliedSuggestion)}`, `expected ${util.inspect(suggestions)} not to include ${util.inspect(expectedAppliedSuggestion)}`, Array(suggestions === null || suggestions === void 0 ? void 0 : suggestions.length).fill(expectedAppliedSuggestion), suggestions, true);
    },
};
//# sourceMappingURL=chai-suggest-assertion.js.map