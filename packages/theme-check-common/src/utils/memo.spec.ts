import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memo, memoize } from './memo';

describe('memo', () => {
  const helloFn = (name: string) => `Hello ${name}!`;
  const goodByeFn = (name: string) => `Goodbye ${name}!`;

  describe('Function: memo', () => {
    it("should memo a function's result", () => {
      const memoedHelloFn = memo(helloFn);
      const memoedGoodByeFn = memo(goodByeFn);

      expect(memoedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoedHelloFn('Josh')).toBe('Hello Bob!');
      expect(memoedGoodByeFn('Alice')).toBe('Goodbye Alice!');
      expect(memoedGoodByeFn('Emily')).toBe('Goodbye Alice!');
    });

    it("should clear the function's result from cache", () => {
      const memoedHelloFn = memo(helloFn);
      const memoedGoodByeFn = memo(goodByeFn);

      expect(memoedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoedGoodByeFn('Alice')).toBe('Goodbye Alice!');

      memoedHelloFn.clearCache();

      expect(memoedHelloFn('Josh')).toBe('Hello Josh!');
      expect(memoedGoodByeFn('Emily')).toBe('Goodbye Alice!');
    });
  });

  describe('Function: memoize', () => {
    let spiedHelloFn: (name: string) => string;

    beforeEach(() => {
      spiedHelloFn = vi.fn(helloFn);
    });

    it("should memoize a function's result by key", () => {
      const memoizedHelloFn = memoize(spiedHelloFn, (name: string) => name);

      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoizedHelloFn('Josh')).toBe('Hello Josh!');

      expect(spiedHelloFn).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache for a specific key', () => {
      const memoizedHelloFn = memoize(spiedHelloFn, (name: string) => name);

      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');

      expect(spiedHelloFn).toHaveBeenCalledTimes(1);

      memoizedHelloFn.invalidate('Bob');

      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');
      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');

      expect(spiedHelloFn).toHaveBeenCalledTimes(2);
    });

    it('should force a recalculation for a specific key', () => {
      const memoizedHelloFn = memoize(spiedHelloFn, (name: string) => name);

      expect(memoizedHelloFn('Bob')).toBe('Hello Bob!');

      expect(spiedHelloFn).toHaveBeenCalledTimes(1);

      expect(memoizedHelloFn.force('Bob')).toBe('Hello Bob!');
      expect(spiedHelloFn).toHaveBeenCalledTimes(2);

      expect(memoizedHelloFn.force('Bob')).toBe('Hello Bob!');
      expect(spiedHelloFn).toHaveBeenCalledTimes(3);
    });
  });
});
