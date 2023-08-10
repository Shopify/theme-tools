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
export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const cachedResult = cache.get(key);

    if (cachedResult !== undefined) {
      return cachedResult;
    } else {
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }
  }) as T;
};
