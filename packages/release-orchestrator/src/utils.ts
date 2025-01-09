import { exec } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'node:util';
import type { RunOptions, StepFunction } from './types';

const execAsync = promisify(exec);
export const readFile = promisify(fs.readFile);

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

export const getRepoRoot = memoize(() => run('git rev-parse --show-toplevel', false));

export const run = async (cmd: string, runInRepoRoot = true): Promise<string> => {
  const execOptions: RunOptions = runInRepoRoot
    ? { encoding: 'utf-8', cwd: await getRepoRoot() }
    : { encoding: 'utf-8' };
  const { stdout, stderr } = await execAsync(cmd, execOptions);
  if (stderr) {
    console.error(stderr);
    return stderr.trim();
  }

  return stdout.trim();
};

export const getRandomId = (numChars: number) => crypto.randomBytes(numChars).toString('hex');

/**
 * Async implementation of lodash's flow function
 */
export const flow = (fns: StepFunction[]) => async () => {
  let result = undefined;

  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    try {
      result = await fn(result);
    } catch (error) {
      console.error(`Error in function ${fn.name}:`, error);
      throw error; // Re-throw the error so it can be handled upstream
    }
  }

  return result;
};
