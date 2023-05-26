import { chai } from 'vitest';
import { createCorrector, flattenFixes } from '../fixes';
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
     * expect(offense).to.suggest(file, 'Use an HTML script tag with the defer attribute instead', {
     *   startIndex: 0,
     *   endIndex: file.length,
     *   insert: '<script ... defer></script>'
     * });
     */
    suggest: (source: string, message: string, suggestion?: Fix) => void;
  }
}

export const SuggestAssertion = {
  name: 'suggest',
  fn: function (this: Chai.AssertionPrototype, ...args: any[]) {
    const offense: Offense = this._obj;
    const source: string = args.at(0);
    const expectedMessage: string = args.at(1);
    const expectedFix: Fix | undefined = args.at(2);

    const suggestions = offense.suggest?.map((suggestion) => {
      const corrector = createCorrector(offense.type, source);
      suggestion.fix(corrector as any);
      return {
        message: suggestion.message,
        fix: flattenFixes(corrector.fix),
      };
    });

    const hasSuggestion = !!suggestions?.some(
      (appliedSuggestion) =>
        util.eql(appliedSuggestion.message, expectedMessage) &&
        (!expectedFix || util.eql(appliedSuggestion.fix, flattenFixes(expectedFix))),
    );

    const ok = !!offense.suggest && offense.suggest.length > 0 && hasSuggestion;
    const expectedAppliedSuggestion = { message: expectedMessage, fix: [expectedFix] };

    this.assert(
      ok,
      `expected ${util.inspect(suggestions)} to include ${util.inspect(expectedAppliedSuggestion)}`,
      `expected ${util.inspect(suggestions)} not to include ${util.inspect(
        expectedAppliedSuggestion,
      )}`,
      Array(suggestions?.length).fill(expectedAppliedSuggestion),
      suggestions,
      true, // show diff
    );
  },
};
