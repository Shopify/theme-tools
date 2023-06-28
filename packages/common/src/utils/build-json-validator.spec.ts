import { expect, describe, it } from 'vitest';
import { Options } from 'ajv';
import { buildValidator, SchemaError } from './build-json-validator';

const sampleSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      },
    },
  },
};
describe('build-json-validator', () => {
  it('buildValidator returns a function', () => {
    const validator = buildValidator(sampleSchema);
    expect(typeof validator).toBe('function');
  });

  it('buildValidator validates correct data', () => {
    const validator = buildValidator(sampleSchema);
    const data = {
      items: [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 28 },
      ],
    };
    const errors = validator(data);
    expect(errors).toEqual([]);
  });

  it('buildValidator returns errors for incorrect data', () => {
    const validator = buildValidator(sampleSchema);
    const data = {
      items: [
        { name: 'John', age: 30 },
        { name: 123, age: '30' },
      ],
    };
    const errors = validator(data);
    const expectedErrors: SchemaError[] = [
      { path: 'items.1.name', message: 'name must be string' },
      { path: 'items.1.age', message: 'age must be number' },
    ];
    expect(errors).toEqual(expectedErrors);
  });

  it('buildValidator returns errors for missing required properties', () => {
    const validator = buildValidator(sampleSchema);
    const data = {
      items: [{ name: 'John', age: 30 }, { age: 28 }],
    };
    const errors = validator(data);
    const expectedErrors: SchemaError[] = [
      { path: 'items.1', message: "1 must have required property 'name'" },
    ];
    expect(errors).toEqual(expectedErrors);
  });

  it('buildValidator respects custom Ajv options', () => {
    const customOptions: Options = { coerceTypes: true };
    const validator = buildValidator(sampleSchema, customOptions);
    const data = {
      items: [
        { name: 'John', age: 30 },
        { name: 123, age: '30' },
      ],
    };
    const errors = validator(data);
    expect(errors).toEqual([]);
  });
});
