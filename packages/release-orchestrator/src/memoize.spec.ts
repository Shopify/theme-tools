import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoize } from './memoize';

describe('memoize', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return the same result as the original function', () => {
    const add = (a: number, b: number) => a + b;
    const memoizedAdd = memoize(add);

    expect(memoizedAdd(1, 2)).toBe(3);
    expect(memoizedAdd(3, 4)).toBe(7);
  });

  it('should cache the result of function calls', () => {
    const add = vi.fn((a: number, b: number) => a + b);
    const memoizedAdd = memoize(add);

    expect(memoizedAdd(1, 2)).toBe(3);
    expect(memoizedAdd(1, 2)).toBe(3);
    expect(add).toHaveBeenCalledTimes(1); // The original function is called only once
  });

  it('should reuse the cached result when the same inputs occur again', () => {
    const add = vi.fn((a: number, b: number) => a + b);
    const memoizedAdd = memoize(add);

    expect(memoizedAdd(1, 2)).toBe(3);
    expect(memoizedAdd(3, 4)).toBe(7);
    expect(memoizedAdd(1, 2)).toBe(3);
    expect(memoizedAdd(3, 4)).toBe(7);
    expect(add).toHaveBeenCalledTimes(2); // The original function is called twice
  });
});
