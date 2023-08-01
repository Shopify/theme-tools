import { expect, describe, it, beforeEach, vi } from 'vitest';
import { withErrorFormatting, SchemaError } from './json-schema-validate-utils';
import { ValidateFunction } from '../types/theme-liquid-docs';

describe('withErrorFormatting', () => {
  let mockValidator: any;

  beforeEach(() => {
    mockValidator = vi.fn();
  });

  it('returns a function', () => {
    const validator = withErrorFormatting(mockValidator as ValidateFunction);
    expect(typeof validator).toBe('function');
  });

  it('returns no items when validator has no errors', () => {
    mockValidator.errors = [];
    const validator = withErrorFormatting(mockValidator as ValidateFunction);
    const errors = validator({});

    expect(errors).toEqual([]);
  });

  it('returns errors for incorrect data', () => {
    mockValidator.errors = [
      { instancePath: '/items/1/name', message: 'must be string' },
      { instancePath: '/items/1/age', message: 'must be number' },
    ];
    const expectedErrors: SchemaError[] = [
      { path: 'items.1.name', message: 'name must be string' },
      { path: 'items.1.age', message: 'age must be number' },
    ];

    const validator = withErrorFormatting(mockValidator as ValidateFunction);
    const errors = validator({});

    expect(errors).toEqual(expectedErrors);
  });
});
