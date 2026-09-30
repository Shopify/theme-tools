import { describe, expect, it } from 'vitest';
import { recommended } from '../index';
import { ValidBlockArgumentTypes } from '../valid-block-argument-types';
import { check, highlightedOffenses } from '../../test';
import { blockSource } from '../../test/block-fixtures';
import { Severity } from '../../types';
import { ValidBlockContentSettingType } from './index';

describe('ValidBlockContentSettingType', () => {
  it('is a recommended error', () => {
    expect(recommended).toContain(ValidBlockContentSettingType);
    expect(ValidBlockContentSettingType.meta.severity).toBe(Severity.ERROR);
  });

  it.each([
    ['number', 'number'],
    ['checkbox', 'boolean'],
    ['product', 'product'],
    ['product_list', 'product[]'],
  ])('reports a %s schema setting named content on its type', async (settingType, liquidType) => {
    const source = blockSource([{ id: 'content', type: settingType }]);

    const offenses = await check({ 'blocks/card.liquid': source }, [ValidBlockContentSettingType]);

    expect(offenses).toMatchObject([
      {
        message: `Schema setting 'content' has Liquid type '${liquidType}', but the built-in 'content' parameter has type 'string'.`,
        severity: Severity.ERROR,
      },
    ]);
    expect(highlightedOffenses({ 'blocks/card.liquid': source }, offenses)).toEqual([
      `"${settingType}"`,
    ]);
  });

  it.each(['text', 'textarea', 'richtext', 'inline_richtext', 'html'])(
    'accepts a string-compatible %s schema setting named content',
    async (settingType) => {
      const offenses = await check(
        { 'blocks/card.liquid': blockSource([{ id: 'content', type: settingType }]) },
        [ValidBlockContentSettingType],
      );

      expect(offenses).toEqual([]);
    },
  );

  it('does not speculate about an unmapped schema setting type named content', async () => {
    const offenses = await check(
      { 'blocks/card.liquid': blockSource([{ id: 'content', type: 'metaobject' }]) },
      [ValidBlockContentSettingType],
    );

    expect(offenses).toEqual([]);
  });

  it('accepts non-string schema settings with other IDs', async () => {
    const offenses = await check(
      { 'blocks/card.liquid': blockSource([{ id: 'count', type: 'number' }]) },
      [ValidBlockContentSettingType],
    );

    expect(offenses).toEqual([]);
  });

  it('does not report a non-string content setting outside theme block files', async () => {
    const offenses = await check(
      { 'sections/main.liquid': blockSource([{ id: 'content', type: 'number' }]) },
      [ValidBlockContentSettingType],
    );

    expect(offenses).toEqual([]);
  });

  it('reports the schema mismatch once alongside ValidBlockArgumentTypes', async () => {
    const source = blockSource(
      [{ id: 'content', type: 'number' }],
      ['@param {string} [content] - Body'],
    );

    const offenses = await check({ 'blocks/card.liquid': source }, [
      ValidBlockArgumentTypes,
      ValidBlockContentSettingType,
    ]);

    expect(offenses).toMatchObject([
      { check: 'ValidBlockContentSettingType', severity: Severity.ERROR },
    ]);
  });

  it('names the built-in parameter as the string authority when schema and LiquidDoc agree on another type', async () => {
    const source = blockSource(
      [{ id: 'content', type: 'number' }],
      ['@param {number} [content] - Body'],
    );

    const offenses = await check({ 'blocks/card.liquid': source }, [
      ValidBlockArgumentTypes,
      ValidBlockContentSettingType,
    ]);

    expect(offenses).toMatchObject([
      {
        check: 'ValidBlockContentSettingType',
        message:
          "Schema setting 'content' has Liquid type 'number', but the built-in 'content' parameter has type 'string'.",
      },
      {
        check: 'ValidBlockArgumentTypes',
        message:
          "The built-in parameter 'content' has Liquid type 'string', but LiquidDoc declares 'number'. The built-in parameter type is authoritative.",
      },
    ]);
    expect(highlightedOffenses({ 'blocks/card.liquid': source }, offenses)).toEqual([
      '"number"',
      '{number}',
    ]);
  });
});
