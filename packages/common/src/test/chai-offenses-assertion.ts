import { Offense, WithOptional } from '../types';

declare module 'vitest' {
  interface Assertion {
    containOffense(
      offense: WithOptional<Offense, 'start' | 'check' | 'end' | 'severity' | 'type'> | string,
    ): Promise<void>;
  }
}

export const OffensesAssertion = {
  name: 'containOffense',
  fn: function (this: Chai.AssertionPrototype, ...args: any[]) {
    const offenses: Offense[] = this._obj;
    const expected: Offense = args.at(0);

    const containsOffense = offenses.some((offense) => {
      if (typeof expected === 'string') {
        return offense.message === expected;
      }

      return isEqual(offense, expected);
    });

    const offensesJson = JSON.stringify(offenses, null, 2);
    const expectedJson = JSON.stringify(expected, null, 2);

    this.assert(
      containsOffense,
      `expected ${offensesJson} to contain offense ${expectedJson}`,
      `expected ${offensesJson} to not contain offense ${expectedJson}`,
      expectedJson,
      offensesJson,
      false, // show diff
    );
  },
};

const pickKeys = <T>(obj: T, keys: string[]): T => {
  return Object.fromEntries(Object.entries(obj as any).filter(([key]) => keys.includes(key))) as T;
};

const isEqual = (actual: Offense, expected: Offense): boolean => {
  const expectedKeys = Object.keys(expected);

  const act = JSON.stringify(pickKeys(actual, expectedKeys));
  const exp = JSON.stringify(pickKeys(expected, expectedKeys));

  return act === exp;
};
