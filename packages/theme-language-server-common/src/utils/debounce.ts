import { ArgumentTypes } from '@shopify/theme-check-common';

export interface DebouncedFunction<F extends Function> {
  /**
   * A function that will execute on the trailing edge of a timer with the
   * last arguments it was called with (unless forced)
   */
  (...args: ArgumentTypes<F>): void;

  /**
   * Debounced version of a function but making sure that it is called with
   * this specific set of arguments.
   *
   * Subsequent calls will be ignored until the timer has expired and the
   * function has executed.
   */
  force(...args: ArgumentTypes<F>): void;
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
 * The debounced function has the same type signature as its argument.
 *
 * The input function must return void (or else you might "bomb" when you resolve).
 *
 * @param fn a function that should be debounced
 * @param ms milliseconds after last function call for it to execute
 * @returns a function that will execute on the trailing edge of a timer with the last argument it was called with
 */
export function debounce<F extends Function>(fn: F, ms?: number): DebouncedFunction<F> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let force = false; // force use a certain set of arguments in the next call

  const debouncedFn = (...args: ArgumentTypes<F>): void => {
    if (timeoutId !== null && force) return;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      await Promise.resolve(fn(...args));
      timeoutId = null;
      force = false;
    }, ms);
  };

  debouncedFn.force = (...args: ArgumentTypes<F>): void => {
    debouncedFn(...args);
    force = true;
  };

  return debouncedFn;
}
