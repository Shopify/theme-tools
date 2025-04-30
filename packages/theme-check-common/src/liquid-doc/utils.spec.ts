import { describe, expect, it } from 'vitest';
import { BasicParamTypes, parseParamType } from './utils';

describe('liquid-doc/utils', () => {
  describe('parseParamType', () => {
    const validParamTypes = new Set([...Object.values(BasicParamTypes), 'product']);

    it('should parse all values provided in the `validParamTypes` set', () => {
      const tests = {
        string: ['string', false],
        product: ['product', false],
        'string[]': ['string', true],
        'product[]': ['product', true],
        invalid: undefined,
      };

      Object.entries(tests).forEach(([input, expected]) => {
        const result = parseParamType(validParamTypes, input);
        expect(result).toEqual(expected);
      });
    });
  });
});
