"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfferFixAssertion = void 0;
const vitest_1 = require("vitest");
const fixes_1 = require("../fixes");
const { util } = vitest_1.chai;
exports.OfferFixAssertion = {
    name: 'offerFix',
    fn: function (...args) {
        var _a;
        const offense = this._obj;
        const source = args.at(0);
        const expectedFix = args.at(1);
        const corrector = (0, fixes_1.createCorrector)(offense.type, source);
        (_a = offense.fix) === null || _a === void 0 ? void 0 : _a.call(offense, corrector);
        const actualFix = corrector.fix;
        const ok = !!offense.fix && util.eql(actualFix, expectedFix);
        this.assert(ok, `expected ${util.inspect(actualFix)} to eql ${util.inspect(expectedFix)}`, `expected ${util.inspect(actualFix)} not to eql ${util.inspect(expectedFix)}`, expectedFix, actualFix, true);
    },
};
//# sourceMappingURL=chai-offer-fix-assertion.js.map