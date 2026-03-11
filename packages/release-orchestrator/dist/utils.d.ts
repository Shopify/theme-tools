import fs from 'fs/promises';
import type { StepFunction } from './types';
export declare const readFile: typeof fs.readFile;
/**
 * Creates a memoized version of a function.
 *
 * The memoized function has the same behavior as the original function, but stores
 * the result of function calls, and reuses the cached result when the same inputs
 * occur again to avoid unnecessary calculations.
 *
 * @param fn - The function to be memoized.
 *
 * @returns The memoized version of `fn`.
 *
 * @template T - The type of the function to be memoized.
 *
 * @example
 *
 * const expensiveFunction = (a: number, b: number) => {
 *   return a + b;  // An expensive computation
 * };
 *
 * const memoizedExpensiveFunction = memoize(expensiveFunction);
 *
 * console.log(memoizedExpensiveFunction(1, 2));  // The result is computed
 * console.log(memoizedExpensiveFunction(1, 2));  // The result is retrieved from the cache
 */
export declare const memoize: <T extends (...args: any[]) => any>(fn: T) => T;
export declare const getRepoRoot: () => Promise<string>;
export declare const run: (cmd: string, runInRepoRoot?: boolean) => Promise<string>;
export declare const getRandomId: (numChars: number) => string;
/**
 * Async implementation of lodash's flow function
 */
export declare const flow: (fns: StepFunction[]) => () => Promise<any>;
