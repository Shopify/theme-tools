import { describe, expect, it, vi } from 'vitest';
import { ValidBlockArgumentTypes } from './index';
import { check } from '../../test';

describe('ValidBlockArgumentTypes', () => {
  it('does not load block parameters when the file has no LiquidDoc parameters', async () => {
    const getBlockSchema = vi.fn(async () => {
      throw new Error('schema provider failed');
    });
    const getDocDefinition = vi.fn(async () => ({ uri: 'file:/blocks/card.liquid' }));

    const offenses = await check(
      { 'blocks/card.liquid': '{{ product.title }}' },
      [ValidBlockArgumentTypes],
      { getBlockSchema, getDocDefinition },
    );

    expect(offenses).toEqual([]);
    expect(getBlockSchema).not.toHaveBeenCalled();
    expect(getDocDefinition).not.toHaveBeenCalled();
  });
});
