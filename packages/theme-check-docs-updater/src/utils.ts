import { Resource, downloadResource } from './themeLiquidDocsDownloader';
import { root } from './themeLiquidDocsDownloader';

export type Logger = (message: string) => void;
export const noop = () => {};

export const identity = <T>(x: T): T => x;
export const tap = <T>(tappingFunction: (x: T) => void) => {
  return (x: T) => {
    tappingFunction(x);
    return x;
  };
};

/** Returns a cached version of a function. Only caches one result. */
export function memo<F extends (...args: any[]) => any>(
  fn: F,
): (...args: ArgumentTypes<F>) => ReturnType<F> {
  let cachedValue: ReturnType<F>;

  return (...args: ArgumentTypes<F>) => {
    if (!cachedValue) {
      cachedValue = fn(...args);
    }
    return cachedValue;
  };
}

export function memoize<AT, F extends (arg: AT) => any, RT extends ReturnType<F>>(
  fn: F,
  keyFn: (arg: AT) => string,
) {
  const cache: Record<string, RT> = {};

  return (arg: AT): RT => {
    const key = keyFn(arg);

    if (!cache[key]) {
      cache[key] = fn(arg);
    }

    return cache[key];
  };
}

/**
 * ArgumentTypes extracts the type of the arguments of a function.
 *
 * @example
 *
 * function doStuff(a: number, b: string) {
 *   // do stuff
 * }
 *
 * type DoStuffArgs = ArgumentTypes<typeof doStuff> // = [number, string].
 */
type ArgumentTypes<F extends Function> = F extends (...args: infer T) => void ? T : never;
