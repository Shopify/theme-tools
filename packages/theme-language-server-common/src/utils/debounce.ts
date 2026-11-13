import { ArgumentTypes } from '@shopify/theme-check-common';

export interface DebouncedFunction<F extends Function> {
  /**
   * A function that executes after the debounce interval. Calls made while a
   * previous invocation is running are queued for a later invocation.
   */
  (...args: ArgumentTypes<F>): void;

  /**
   * Mark this call as forced. Later calls may be queued, but do not replace
   * this call while it is waiting for the timer.
   */
  force(...args: ArgumentTypes<F>): void;
}

/**
 * debounce(fn, ms)
 *
 * Calls made before the timer expires are debounced. Calls made while the
 * function is running are queued and run after the current invocation finishes.
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
 * @param mergeArguments how to combine pending arguments. By default, the
 * arguments from the latest call are used.
 * @returns a debounced function
 */
export function debounce<F extends Function>(
  fn: F,
  ms?: number,
  mergeArguments: (previous: ArgumentTypes<F>, next: ArgumentTypes<F>) => ArgumentTypes<F> = (
    _previous,
    next,
  ) => next,
): DebouncedFunction<F> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: ArgumentTypes<F> | null = null;
  let running = false;
  let forcePending = false;

  const schedule = () => {
    if (running || timeoutId !== null || pendingArgs === null) return;

    timeoutId = setTimeout(() => {
      timeoutId = null;
      const args = pendingArgs;
      pendingArgs = null;
      forcePending = false;
      if (args === null) return;

      running = true;
      Promise.resolve()
        .then(() => fn(...args))
        .finally(() => {
          running = false;
          schedule();
        });
    }, ms);
  };

  const enqueue = (args: ArgumentTypes<F>, force: boolean) => {
    pendingArgs = pendingArgs === null ? args : mergeArguments(pendingArgs, args);

    if (running) {
      if (force) forcePending = true;
      return;
    }

    if (timeoutId !== null) {
      if (forcePending && !force) return;
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    schedule();
    if (force) forcePending = true;
  };

  const debouncedFn = (...args: ArgumentTypes<F>): void => enqueue(args, false);
  debouncedFn.force = (...args: ArgumentTypes<F>): void => enqueue(args, true);

  return debouncedFn;
}
