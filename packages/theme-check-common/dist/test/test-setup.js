"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const contain_offense_1 = require("./contain-offense");
const chai_offer_fix_assertion_1 = require("./chai-offer-fix-assertion");
const chai_suggest_assertion_1 = require("./chai-suggest-assertion");
/**
 * Setup chai extensions
 *
 * These are deprecated in favor of vitest matchers.
 */
const chaiAssertions = [chai_offer_fix_assertion_1.OfferFixAssertion, chai_suggest_assertion_1.SuggestAssertion];
chaiAssertions.forEach(({ name, fn }) => {
    vitest_1.chai.Assertion.addMethod(name, fn);
});
/**
 * Setup vitest matcher extensions
 *
 * All new matchers should be written this way.
 */
vitest_1.expect.extend({ containOffense: contain_offense_1.containOffense });
process.on('unhandledRejection', (reason) => {
    console.error(reason);
    debugger;
});
//# sourceMappingURL=test-setup.js.map