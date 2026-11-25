import { describe, expect, it } from 'vitest';
import { LiquidTagRender, toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import {
  BasicParamTypes,
  ArgumentTypeCheck,
  checkArgumentType,
  getDefaultValueForType,
  parseParamType,
} from './utils';

const compatible: ArgumentTypeCheck = { kind: 'compatible' };
const incompatible: ArgumentTypeCheck = { kind: 'incompatible' };
const unchecked: ArgumentTypeCheck = { kind: 'unchecked' };
const namedType = (type: string): ArgumentTypeCheck => ({ kind: 'named-type', type });

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

  describe('checkArgumentType', () => {
    it.each([
      ["'heading' | 'small'", "'heading'", compatible],
      ["'heading' | 'small'", '"small"', compatible],
      ["'heading' | 'small'", "'Heading'", incompatible],
      ["'heading' | 'small'", "'large'", incompatible],
      ["'heading' | 'small'", '42', incompatible],
      ["'heading' | 'small'", 'nil', incompatible],
      ["'heading' | 'small'", 'true', incompatible],
      ["'heading' | 'small'", '(1..3)', incompatible],
      ["'heading' | 'small'", 'block.settings.variant', unchecked],
      ["'heading' |", "'small'", unchecked],
      ['product', '42', namedType('product')],
      ['Product[]', '42', namedType('product[]')],
      ['string[]', "'heading'", namedType('string[]')],
      ['product', 'product', unchecked],
      ['product[', '42', unchecked],
      ['String', "'heading'", compatible],
      ['NUMBER', '42', compatible],
      ['boolean', "'heading'", compatible],
      ['string', '42', incompatible],
    ])('checks %s against %s', (type, value, expected) => {
      const ast = toLiquidHtmlAST(`{% render 'text', variant: ${value} %}`);
      const render = ast.children[0] as LiquidTagRender;
      expect(checkArgumentType(type, render.markup.args[0].value)).toEqual(expected);
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
