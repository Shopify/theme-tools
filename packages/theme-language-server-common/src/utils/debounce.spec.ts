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

  it('keeps the forced arguments without a merge function', async () => {
    vi.useFakeTimers();
    const run = vi.fn<(values: string[]) => void>();
    const debouncedRun = debounce(run, 100);

    debouncedRun(['first']);
    debouncedRun.force(['forced']);
    debouncedRun(['after-force']);

    await vi.advanceTimersByTimeAsync(100);

    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(['forced']);
  });

  it('keeps running while forced calls arrive faster than the interval', async () => {
    vi.useFakeTimers();
    const run = vi.fn<(values: string[]) => void>();
    const debouncedRun = debounce(run, 30, mergeValues);
    const forced: string[] = [];

    for (let i = 0; i < 30; i++) {
      forced.push(`file-${i}`);
      debouncedRun.force([`file-${i}`]);
      await vi.advanceTimersByTimeAsync(10);
    }

    // 300 ms of forced calls with a 30 ms interval.
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(9);

    await vi.advanceTimersByTimeAsync(30);
    expect(run.mock.calls.flatMap(([values]) => values)).toEqual(forced);
  });

  it('runs a forced call on time when another forced call follows it', async () => {
    vi.useFakeTimers();
    const run = vi.fn<(values: string[]) => void>();
    const debouncedRun = debounce(run, 100, mergeValues);

    debouncedRun.force(['first']);
    await vi.advanceTimersByTimeAsync(50);
    debouncedRun(['normal']);
    debouncedRun.force(['second']);
    await vi.advanceTimersByTimeAsync(50);

    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(['first', 'normal', 'second']);
  });

  it('runs a forced call on time while normal calls keep arriving', async () => {
    vi.useFakeTimers();
    const run = vi.fn<(values: string[]) => void>();
    const debouncedRun = debounce(run, 100, mergeValues);

    debouncedRun.force(['forced']);
    for (let i = 0; i < 9; i++) {
      await vi.advanceTimersByTimeAsync(10);
      debouncedRun([`normal-${i}`]);
    }
    await vi.advanceTimersByTimeAsync(10);

    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toHaveLength(10);
  });

  it('runs a forced call one interval after it, even when a normal call came first', async () => {
    vi.useFakeTimers();
    const run = vi.fn<(values: string[]) => void>();
    const debouncedRun = debounce(run, 100, mergeValues);

    debouncedRun(['normal']);
    await vi.advanceTimersByTimeAsync(50);
    debouncedRun.force(['forced']);
    await vi.advanceTimersByTimeAsync(99);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(['normal', 'forced']);
  });

  it('debounces normal calls again after a forced run', async () => {
    vi.useFakeTimers();
    const run = vi.fn<(values: string[]) => void>();
    const debouncedRun = debounce(run, 100, mergeValues);

    debouncedRun.force(['forced']);
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledOnce();

    debouncedRun(['first']);
    await vi.advanceTimersByTimeAsync(50);
    debouncedRun(['second']);
    await vi.advanceTimersByTimeAsync(99);
    expect(run).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(['first', 'second']);
  });

  it('runs a forced call made during an invocation one interval after it ends', async () => {
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
    debouncedRun.force(['forced-during-run']);
    finishFirstRun();
    await vi.advanceTimersByTimeAsync(50);
    debouncedRun.force(['forced-after-run']);
    debouncedRun(['normal-after-run']);
    await vi.advanceTimersByTimeAsync(50);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith([
      'forced-during-run',
      'forced-after-run',
      'normal-after-run',
    ]);
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
