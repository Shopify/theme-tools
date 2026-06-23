import { describe, expect, it } from 'vitest';
import { BasicParamTypes, getDefaultValueForType, isTypeCompatible, parseParamType } from './utils';

describe('liquid-doc/utils', () => {
  const validParamTypes = new Set([...Object.values(BasicParamTypes), 'product']);

  describe('parseParamType', () => {
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

    it('should accept union of named types', () => {
      expect(parseParamType(validParamTypes, 'string|number')).toBeDefined();
      expect(parseParamType(validParamTypes, 'string|number|boolean')).toBeDefined();
      expect(parseParamType(validParamTypes, 'string|product')).toBeDefined();
    });

    it('should accept string literal types', () => {
      expect(parseParamType(validParamTypes, "'banner'")).toBeDefined();
      expect(parseParamType(validParamTypes, '"banner"')).toBeDefined();
      expect(parseParamType(validParamTypes, "'banner'|'label'")).toBeDefined();
    });

    it('should accept union of named types and string literals', () => {
      expect(parseParamType(validParamTypes, "string|'banner'")).toBeDefined();
      expect(parseParamType(validParamTypes, "'banner'|number")).toBeDefined();
    });

    it('should return string as pseudoType for literal-only unions', () => {
      expect(parseParamType(validParamTypes, "'banner'|'label'")).toEqual(['string', false]);
    });

    it('should return the first named type as pseudoType for mixed unions', () => {
      expect(parseParamType(validParamTypes, 'number|string')).toEqual(['number', false]);
    });

    it('should reject unions containing invalid named types', () => {
      expect(parseParamType(validParamTypes, 'string|invalidType')).toBeUndefined();
      expect(parseParamType(validParamTypes, "'banner'|invalidType")).toBeUndefined();
    });

    it('should reject bare unquoted values that are not valid named types', () => {
      expect(parseParamType(validParamTypes, 'banner')).toBeUndefined();
    });
  });

  describe('isTypeCompatible', () => {
    it('should return true when types match exactly', () => {
      expect(isTypeCompatible('string', BasicParamTypes.String)).toBe(true);
      expect(isTypeCompatible('number', BasicParamTypes.Number)).toBe(true);
    });

    it('should return false when types do not match', () => {
      expect(isTypeCompatible('string', BasicParamTypes.Number)).toBe(false);
      expect(isTypeCompatible('number', BasicParamTypes.String)).toBe(false);
    });

    it('should return true for boolean regardless of actual type', () => {
      expect(isTypeCompatible('boolean', BasicParamTypes.String)).toBe(true);
      expect(isTypeCompatible('boolean', BasicParamTypes.Number)).toBe(true);
    });

    it('should return true when actual type matches any member of a union', () => {
      expect(isTypeCompatible('string|number', BasicParamTypes.String)).toBe(true);
      expect(isTypeCompatible('string|number', BasicParamTypes.Number)).toBe(true);
    });

    it('should return false when actual type matches no member of a union', () => {
      expect(isTypeCompatible('string|number', BasicParamTypes.Boolean)).toBe(false);
    });

    it('should return true for string args against a string literal union', () => {
      expect(isTypeCompatible("'banner'|'label'", BasicParamTypes.String)).toBe(true);
    });

    it('should return false for non-string args against a string literal union', () => {
      expect(isTypeCompatible("'banner'|'label'", BasicParamTypes.Number)).toBe(false);
    });

    it('should return true for string args against a mixed literal and named union', () => {
      expect(isTypeCompatible("'banner'|number", BasicParamTypes.String)).toBe(true);
      expect(isTypeCompatible("'banner'|number", BasicParamTypes.Number)).toBe(true);
    });
  });

  describe('getDefaultValueForType', () => {
    it('should return defaults for basic types', () => {
      expect(getDefaultValueForType('string')).toBe("''");
      expect(getDefaultValueForType('number')).toBe('0');
      expect(getDefaultValueForType('boolean')).toBe('false');
      expect(getDefaultValueForType('object')).toBe('');
      expect(getDefaultValueForType(null)).toBe('');
    });

    it('should use the first member default for union of named types', () => {
      expect(getDefaultValueForType('string|number')).toBe("''");
      expect(getDefaultValueForType('number|string')).toBe('0');
    });

    it('should use the first string literal as default for literal unions', () => {
      expect(getDefaultValueForType("'banner'|'label'")).toBe("'banner'");
      expect(getDefaultValueForType('"banner"|"label"')).toBe('"banner"');
    });

    it('should use the first literal as default for mixed unions', () => {
      expect(getDefaultValueForType("'banner'|string")).toBe("'banner'");
    });
  });
});
