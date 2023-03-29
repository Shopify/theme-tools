import { ArgumentTypes } from './types';

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
