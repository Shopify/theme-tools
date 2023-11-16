import { ArgumentTypes } from './types';

export type MemoedFunction<F extends (...args: any[]) => any> = {
  /** Only the first call is cached */
  (...args: ArgumentTypes<F>): ReturnType<F>;
  /** Clear cache */
  clearCache(): void;
};

const Unset = Symbol('Unset');

/** Returns a cached version of a function. Only caches one result. */
export function memo<F extends (...args: any[]) => any>(fn: F): MemoedFunction<F> {
  let cachedValue: ReturnType<F> | typeof Unset = Unset;

  const memoedFunction = (...args: ArgumentTypes<F>) => {
    if (cachedValue === Unset) {
      cachedValue = fn(...args);
    }
    return cachedValue as ReturnType<F>;
  };

  memoedFunction.clearCache = () => {
    cachedValue = Unset;
  };

  return memoedFunction;
}

/**
 * Returns a function that is cached-by-keyFn(argument)
 *
 * e.g.
 *
 * const expensiveFunction = (thing: Thing) => ...
 * const thingToString = (thing: Thing): string => ...
 * const fastOnSubsequentCalls = memoize(
 *   expensiveFunction,
 *   thingToString,
 * );
 *
 * // slow first run
 * fastOnSubsequentCalls(thing1);
 *
 * // fast subsequent ones
 * fastOnSubsequentCalls(thing1);
 * fastOnSubsequentCalls(thing1);
 */
export function memoize<AT, RT, F extends (arg: AT) => RT>(fn: F, keyFn: (arg: AT) => string) {
  const cache: Record<string, RT> = {};

  return (arg: AT): RT => {
    const key = keyFn(arg);

    if (!cache[key]) {
      cache[key] = fn(arg);
    }

    return cache[key];
  };
}
