import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

const mergeValues = (previous: [string[]], next: [string[]]): [string[]] => [
  [...new Set([...previous[0], ...next[0]])],
];

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('merges calls made before a forced run', async () => {
    vi.useFakeTimers();
    const run = vi.fn<(values: string[]) => void>();
    const debouncedRun = debounce(run, 100, mergeValues);

    debouncedRun(['first']);
    debouncedRun.force(['second']);
    debouncedRun(['third']);

    await vi.advanceTimersByTimeAsync(100);

    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(['first', 'second', 'third']);
  });

  it('queues calls made while an asynchronous invocation is running', async () => {
    vi.useFakeTimers();
    let finishFirstRun!: () => void;
    const firstRun = new Promise<void>((resolve) => {
      finishFirstRun = resolve;
    });
    const run = vi
      .fn<(values: string[]) => Promise<void>>()
      .mockImplementationOnce(() => firstRun)
      .mockResolvedValue(undefined);
    const debouncedRun = debounce(run, 100, mergeValues);

    debouncedRun(['first']);
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledOnce();

    debouncedRun(['during-run']);
    debouncedRun.force(['forced-during-run']);
    await vi.advanceTimersByTimeAsync(500);
    expect(run).toHaveBeenCalledOnce();

    finishFirstRun();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(['during-run', 'forced-during-run']);
  });
});
