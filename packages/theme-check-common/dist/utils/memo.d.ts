import { ArgumentTypes } from './types';
export type MemoedFunction<F extends (...args: any[]) => any> = {
    /** Only the first call is cached */
    (...args: ArgumentTypes<F>): ReturnType<F>;
    /** Clear cache */
    clearCache(): void;
};
/** Returns a cached version of a function. Only caches one result. */
export declare function memo<F extends (...args: any[]) => any>(fn: F): MemoedFunction<F>;
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
export declare function memoize<AT extends any[], RT>(fn: (...args: AT) => RT, keyFn: (...args: AT) => string): {
    (...args: AT): RT;
    force(...args: AT): RT;
    invalidate(...args: AT): void;
    clearCache(): void;
};
