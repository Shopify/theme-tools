import { SourceCode, SourceCodeType } from '@shopify/theme-check-common';

export function immutableMapSet<K, V>(
  oldMap: Map<K, V>,
  newKey: K,
  newValue: V,
): Map<K, V> {
  return new Map([...oldMap.entries(), [newKey, newValue]]);
}

export function immutableMapDelete<K, V>(
  oldMap: Map<K, V>,
  removeKey: K,
): Map<K, V> {
  return new Map([...oldMap.entries()].filter(([key, _]) => key !== removeKey));
}

export function assertNever(value: never): never {
  throw new Error(
    `ERROR! Reached forbidden guard function with unexpected value: ${JSON.stringify(
      value,
    )}`,
  );
}

/**
 * debounce(fn, ms)
 *
 * A debounced function only executes once after a timer has expired. Repeated
 * call to the debounced function before its timer has expired result in a delayed
 * execution of the function.
 *
 * This is useful in cases where you have an "expensive" function that you only want
 * to execute after the user is idle for a little bit.
 *
 * e.g. Run theme check after the user has stopped typing for at least 100ms.
 *
 * The debounced function has the same type signature as its first argument.
 *
 * The input function must return void (or else you might "bomb" when you resolve).
 *
 * @param fn a function that should be debounced
 * @param ms milliseconds after last function call for it to execute
 * @returns a function that will execute on the trailing edge of a timer.
 */
export function debounce<F extends Function>(fn: F, ms?: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: ArgumentTypes<F>): void => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, ms);
  };
}

/**
 * ArgumentTypes extracts the type of the arguments of a function.
 *
 * @example
 * function doStuff(a: number, b: string) {}
 * type DoStuffArgs = ArgumentTypes<typeof doStuff> // = [number, string].
 */
export type ArgumentTypes<F extends Function> = F extends (
  ...args: infer T
) => void
  ? T
  : never;
