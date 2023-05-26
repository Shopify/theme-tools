import { chai } from 'vitest';
import { OffensesAssertion } from './chai-offenses-assertion';
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

// Setup chai extensions
const newMethods = [OffensesAssertion, OfferFixAssertion, SuggestAssertion];
newMethods.forEach(({ name, fn }) => {
  chai.Assertion.addMethod(name, fn);
});
