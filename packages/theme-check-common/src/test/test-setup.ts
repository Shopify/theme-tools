import { chai, expect } from 'vitest';
import { containOffense } from './contain-offense';
import { OfferFixAssertion } from './chai-offer-fix-assertion';
import { SuggestAssertion } from './chai-suggest-assertion';

// Undocumented, but chai/utils has `.eql` for deep equality checks
declare global {
  export namespace Chai {
    interface ChaiUtils {
      /** deep equality */
      eql: (a: any, b: any) => boolean;
    }
  }
}

/**
 * Setup chai extensions
 *
 * These are deprecated in favor of vitest matchers.
 */
const chaiAssertions = [OfferFixAssertion, SuggestAssertion];
chaiAssertions.forEach(({ name, fn }) => {
  chai.Assertion.addMethod(name, fn);
});

/**
 * Setup vitest matcher extensions
 *
 * All new matchers should be written this way.
 */
expect.extend({ containOffense });

process.on('unhandledRejection', (reason) => {
  console.error(reason);
  debugger;
});
