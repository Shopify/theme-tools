import { describe, expect, it } from 'vitest';
import { buildThemeLiquidDocsBundle } from './themeLiquidDocsBundle';

const manager = {
  revision: async () => '40f966fc7793462726d9f8573c8d522f8ab44c54',
  tags: async () => [{ name: 'if' }],
  filters: async () => [{ name: 'upcase' }],
  objects: async () => [{ name: 'product' }],
  systemTranslations: async () => ({ 'shopify.checkout.general.cart': 'Cart' }),
  schemas: async (mode: 'theme') => [
    {
      uri: `https://example.com/schemas/${mode}.json`,
      fileMatch: ['templates/*.json'],
      schema: '{"type":"object"}',
    },
  ],
};

describe('Module: themeLiquidDocsBundle', () => {
  it('builds a self-contained Liquid docs bundle', async () => {
    await expect(buildThemeLiquidDocsBundle(manager)).resolves.toEqual({
      schemaVersion: 1,
      revision: '40f966fc7793462726d9f8573c8d522f8ab44c54',
      tags: [{ name: 'if' }],
      filters: [{ name: 'upcase' }],
      objects: [{ name: 'product' }],
      systemTranslations: { 'shopify.checkout.general.cart': 'Cart' },
      schemas: [
        {
          uri: 'https://example.com/schemas/theme.json',
          fileMatch: ['templates/*.json'],
          schema: '{"type":"object"}',
        },
      ],
    });
  });

  it('throws when the revision cannot be determined', async () => {
    await expect(
      buildThemeLiquidDocsBundle({
        ...manager,
        revision: async () => '',
      }),
    ).rejects.toThrow('Unable to determine the theme-liquid-docs revision.');
  });
});
