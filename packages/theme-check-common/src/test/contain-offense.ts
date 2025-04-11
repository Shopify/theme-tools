import { ExpectationResult, MatcherState, RawMatcherFn } from '@vitest/expect';
import { Offense } from '../types';

interface CustomMatchers<R = unknown> {
  containOffense(offense: any): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

export const containOffense: RawMatcherFn<MatcherState> = function (
  this: MatcherState,
  offenses: Offense[],
  expected: any,
): ExpectationResult {
  const { isNot, equals } = this;

  const isExpectingString = typeof expected === 'string';
  if (isExpectingString) {
    const containsMessage = offenses.some((offense) => offense.message === expected);

    return {
      pass: containsMessage,
      message: () =>
        `expected offenses to ${isNot ? 'not ' : ''}contain offense with message ${expected}`,
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
