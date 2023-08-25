import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import { flow } from './flow';

vi.stubGlobal('console', {
  error: vi.fn(),
});

describe('flow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should call each function in array with the result of the previous function', async () => {
    const fn1 = vi.fn().mockResolvedValueOnce('result1');
    const fn2 = vi.fn().mockResolvedValueOnce('result2');
    const fn3 = vi.fn().mockResolvedValueOnce('result3');

    const result = await flow([fn1, fn2, fn3])();

    expect(fn1).toHaveBeenCalledWith(undefined);
    expect(fn2).toHaveBeenCalledWith('result1');
    expect(fn3).toHaveBeenCalledWith('result2');
    expect(result).toBe('result3');
  });

  it('should throw error if any function in the array throws an error', async () => {
    const fn1 = vi.fn().mockResolvedValueOnce('result1');
    const fn2 = vi.fn().mockRejectedValueOnce(new Error('test error'));
    const fn3 = vi.fn();

    await expect(flow([fn1, fn2, fn3])()).rejects.toThrow('test error');
    expect(fn1).toHaveBeenCalledWith(undefined);
    expect(fn2).toHaveBeenCalledWith('result1');
    expect(fn3).not.toHaveBeenCalled();
  });
});
