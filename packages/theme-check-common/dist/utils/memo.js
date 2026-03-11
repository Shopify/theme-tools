"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memo = memo;
exports.memoize = memoize;
const Unset = Symbol('Unset');
/** Returns a cached version of a function. Only caches one result. */
function memo(fn) {
    let cachedValue = Unset;
    const memoedFunction = (...args) => {
        if (cachedValue === Unset) {
            cachedValue = fn(...args);
        }
        return cachedValue;
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
function memoize(fn, keyFn) {
    let cache = {};
    const memoedFunction = (...args) => {
        const key = keyFn(...args);
        if (!cache[key]) {
            cache[key] = fn(...args);
        }
        return cache[key];
    };
    memoedFunction.force = (...args) => {
        memoedFunction.invalidate(...args);
        return memoedFunction(...args);
    };
    memoedFunction.invalidate = (...args) => {
        const key = keyFn(...args);
        delete cache[key];
    };
    memoedFunction.clearCache = () => {
        cache = {};
    };
    return memoedFunction;
}
//# sourceMappingURL=memo.js.map