import { beforeEach, describe, expect, it } from 'vitest';
import {
  makeGetDefaultLocale,
  makeGetDefaultTranslations,
  makeGetMetafieldDefinitions,
} from './context-utils';
import { MockFileSystem } from './test';
import { AbstractFileSystem } from './AbstractFileSystem';

describe('Unit: getDefaultLocale', () => {
  let fs: AbstractFileSystem;
  beforeEach(() => {
    fs = new MockFileSystem(
      {
        'gitRootTheme/locales/en.default.json': JSON.stringify({ beverage: 'coffee' }),
        'gitRootTheme/locales/fr.json': JSON.stringify({ beverage: 'coffee' }),
        'gitRootTheme/snippet/foo.liquid': JSON.stringify({ beverage: 'coffee' }),
        'frenchDefault/locales/fr.default.json': JSON.stringify({ beverage: 'café' }),
        'frenchDefault/snippet/foo.liquid': JSON.stringify({ beverage: 'coffee' }),
        '.shopify/metafields.json': JSON.stringify({
          product: [
            {
              key: 'color',
              name: 'color',
              namespace: 'custom',
              description: 'the color of the product',
              type: {
                category: 'COLOR',
                name: 'color',
              },
            },
          ],
        }),
      },
      'shopify-vfs:/',
    );
  });

  it('should return the correct translations depending on the root', async () => {
    let getDefaultLocale = makeGetDefaultLocale(fs, 'shopify-vfs:/gitRootTheme');
    expect(await getDefaultLocale()).to.eql('en');

    getDefaultLocale = makeGetDefaultLocale(fs, 'shopify-vfs:/frenchDefault');
    expect(await getDefaultLocale()).to.eql('fr');
  });

  describe('Unit: makeGetMetafieldDefinitions', () => {
    it('should return metafield definitions in correct format', async () => {
      const getMetafieldDefinitions = makeGetMetafieldDefinitions(fs);

      let definitions = await getMetafieldDefinitions('shopify-vfs:/');

      expect(definitions.product).toHaveLength(1);
      expect(definitions.product[0]).deep.equals({
        key: 'color',
        name: 'color',
        namespace: 'custom',
        description: 'the color of the product',
        type: {
          category: 'COLOR',
          name: 'color',
        },
      });
    });

    it("should return no metafield definitions if file isn't in correct format", async () => {
      fs = new MockFileSystem(
        {
          '.shopify/metafields.json': JSON.stringify('uhoh'),
        },
        'shopify-vfs:/',
      );
      const getMetafieldDefinitions = makeGetMetafieldDefinitions(fs);

      let definitions = await getMetafieldDefinitions('shopify-vfs:/');

      expect(definitions).deep.equals({
        article: [],
        blog: [],
        collection: [],
        company: [],
        company_location: [],
        location: [],
        market: [],
        order: [],
        page: [],
        product: [],
        variant: [],
        shop: [],
      });
    });
  });

  describe('Unit: getDefaultTranslationsFactory', () => {
    it('should return the correct translations depending on the root', async () => {
      let getDefaultTranslations = makeGetDefaultTranslations(fs, [], 'shopify-vfs:/gitRootTheme');
      expect(await getDefaultTranslations()).to.eql({ beverage: 'coffee' });

      getDefaultTranslations = makeGetDefaultTranslations(fs, [], 'shopify-vfs:/frenchDefault');
      expect(await getDefaultTranslations()).to.eql({ beverage: 'café' });
    });
  });
});
