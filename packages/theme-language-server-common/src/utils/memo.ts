import { ArgumentTypes } from './types';

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
