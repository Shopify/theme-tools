import { chai } from 'vitest';
import { createCorrector } from '../fixes';
import { Offense, Fix } from '../types';
const { util } = chai;

declare module 'vitest' {
  interface Assertion {
    /**
     * @param source {string} - the source to correct
     * @param message {string} - the suggestion message
     * @param fix {Fix} - the Fix suggested
     *
     * @example
     * expect(offense).to.offerFix(file, {
     *   startIndex: 0,
     *   endIndex: file.length,
     *   insert: '<script ... defer></script>'
     * });
     */
    offerFix: (source: string, fix: Fix) => void;
  }
}

export const OfferFixAssertion = {
  name: 'offerFix',
  fn: function (this: Chai.AssertionPrototype, ...args: any[]) {
    const offense: Offense = this._obj;
    const source: string = args.at(0);
    const expectedFix: Fix | undefined = args.at(1);
    const corrector = createCorrector(offense.type, source);
    offense.fix?.(corrector as any);
    const actualFix = corrector.fix;

    const ok = !!offense.fix && util.eql(actualFix, expectedFix);

    this.assert(
      ok,
      `expected ${util.inspect(actualFix)} to eql ${util.inspect(expectedFix)}`,
      `expected ${util.inspect(actualFix)} not to eql ${util.inspect(expectedFix)}`,
      expectedFix,
      actualFix,
      true, // show diff
    );
  },
};
