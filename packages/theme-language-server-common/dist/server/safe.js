"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safe = void 0;
/**
 * This function wraps a function that might throw an error and handles it by
 * returning the default value instead.
 *
 * There are cases, such as fs.readDirectory, that might throw an error if the
 * directory doesn't exist. Since there _is_ a difference between a directory that
 * doesn't exist and a directory that is empty, we don't want to change the API
 * of fs.readDirectory either.
 *
 * In such cases, we can use this helper to wrap the function and gracefully handle
 * the error by returning a default value instead.
 *
 * @param fn
 * @param defaultReturnValue
 *
 * @example
 * const getThemeBlockNames = safe(async function () { ... }, []);
 */
const safe = (fn, defaultReturnValue) => {
    return async function safeFn(...args) {
        try {
            return await fn(...args);
        }
        catch (error) {
            return defaultReturnValue;
        }
    };
};
exports.safe = safe;
//# sourceMappingURL=safe.js.map