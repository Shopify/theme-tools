import { describe, it, expect } from 'vitest';
import { ParseErrorCode } from 'jsonc-parser';
import { asError, isError } from './error';

describe('Function: asError', () => {
  it('should return the same Error instance if given an Error', () => {
    const error = new Error('An error occurred');

    const result = asError(error);

    expect(result).toBe(error);
    expect(result.message).toBe('An error occurred');
  });

  it('should create an Error from a string message', () => {
    const error = 'Error string';

    const result = asError(error);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Error string');
  });

  it('should create an Error from a ParseError with InvalidSymbol code', () => {
    const error = {
      error: ParseErrorCode.InvalidSymbol,
      offset: 0,
      length: 1,
    };

    const result = asError(error);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Invalid symbol found in the input.');
  });

  it('should create an Error from any object with toString function', () => {
    const error = {
      toString: () => 'Custom error description',
    };

    const result = asError(error);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Custom error description');
  });

  it('should create a generic Error for unknown errors', () => {
    const error = null;
    const result = asError(error);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('An unknown error occurred');
  });
});

describe('Function: isError', () => {
  it('should return true for Error instances', () => {
    const error = new Error('An error occurred');
    const result = isError(error);

    expect(result).toBe(true);
  });

  it('should return false for non-Error instances', () => {
    const error = 'Error string';
    const result = isError(error);

    expect(result).toBe(false);
  });
});
