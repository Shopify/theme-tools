import { describe, expect, it } from 'vitest';
import { LiquidTagRender, toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import {
  BasicParamTypes,
  getDefaultValueForType,
  isArgumentTypeCompatible,
  parseParamType,
} from './utils';

describe('liquid-doc/utils', () => {
  describe('getDefaultValueForType', () => {
    it.each([
      ["'Heading' | 'small'", "'Heading'"],
      [` "it's" | 'small' `, `"it's"`],
      ["'' | 'small'", "''"],
      ["'heading' |", ''],
      ['string', "''"],
      ['NUMBER', '0'],
      ['boolean', 'false'],
      ['object', ''],
      [null, ''],
    ])('suggests a valid literal for %s', (type, expected) => {
      expect(getDefaultValueForType(type)).toBe(expected);
    });
  });

  describe('isArgumentTypeCompatible', () => {
    it.each([
      ["'heading' | 'small'", "'heading'", true],
      ["'heading' | 'small'", '"small"', true],
      ["'heading' | 'small'", "'Heading'", false],
      ["'heading' | 'small'", "'large'", false],
      ["'heading' | 'small'", '42', false],
      ["'heading' | 'small'", 'nil', false],
      ["'heading' | 'small'", 'true', false],
      ["'heading' | 'small'", '(1..3)', false],
      ["'heading' | 'small'", 'block.settings.variant', undefined],
      ["'heading' |", "'small'", undefined],
      ['product', '42', undefined],
      ['string[]', "'heading'", undefined],
      ['String', "'heading'", true],
      ['NUMBER', '42', true],
      ['boolean', "'heading'", true],
      ['string', '42', false],
    ] as const)('checks %s against %s', (type, value, expected) => {
      const ast = toLiquidHtmlAST(`{% render 'text', variant: ${value} %}`);
      const render = ast.children[0] as LiquidTagRender;
      expect(isArgumentTypeCompatible(type, render.markup.args[0].value)).toBe(expected);
    });
  });

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
