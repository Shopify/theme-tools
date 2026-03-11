"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flow = exports.getRandomId = exports.run = exports.getRepoRoot = exports.memoize = exports.readFile = void 0;
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const node_util_1 = require("node:util");
const execAsync = (0, node_util_1.promisify)(child_process_1.exec);
exports.readFile = promises_1.default.readFile;
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
const memoize = (fn) => {
    const cache = new Map();
    return ((...args) => {
        const key = JSON.stringify(args);
        const cachedResult = cache.get(key);
        if (cachedResult !== undefined) {
            return cachedResult;
        }
        else {
            const result = fn(...args);
            cache.set(key, result);
            return result;
        }
    });
};
exports.memoize = memoize;
exports.getRepoRoot = (0, exports.memoize)(() => (0, exports.run)('git rev-parse --show-toplevel', false));
const run = async (cmd, runInRepoRoot = true) => {
    const execOptions = runInRepoRoot
        ? { encoding: 'utf-8', cwd: await (0, exports.getRepoRoot)() }
        : { encoding: 'utf-8' };
    let { stdout, stderr } = await execAsync(cmd, execOptions);
    stdout = Buffer.isBuffer(stdout) ? stdout.toString('utf-8') : stdout;
    stderr = Buffer.isBuffer(stderr) ? stderr.toString('utf-8') : stderr;
    if (stderr) {
        console.error(stderr);
        return stderr.trim();
    }
    return stdout.trim();
};
exports.run = run;
const getRandomId = (numChars) => crypto_1.default.randomBytes(numChars).toString('hex');
exports.getRandomId = getRandomId;
/**
 * Async implementation of lodash's flow function
 */
const flow = (fns) => async () => {
    let result = undefined;
    for (let i = 0; i < fns.length; i++) {
        const fn = fns[i];
        try {
            result = await fn(result);
        }
        catch (error) {
            console.error(`Error in function ${fn.name}:`, error);
            throw error; // Re-throw the error so it can be handled upstream
        }
    }
    return result;
};
exports.flow = flow;
//# sourceMappingURL=utils.js.map