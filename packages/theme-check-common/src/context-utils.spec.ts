import { beforeEach, describe, expect, it } from 'vitest';
import { MockFileSystem } from './test';
import {
  makeGetDefaultLocale,
  makeGetDefaultTranslations,
  makeGetLiquidDocDefinitions,
  makeGetMetafieldDefinitions,
} from './context-utils';
import { AbstractFileSystem } from './AbstractFileSystem';
import { toSourceCode } from './to-source-code';
import { LiquidHtmlNode } from '@shopify/liquid-html-parser';

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
        brand: [],
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

  describe('Unit: makeGetLiquidDocDefinitions', () => {
    function toAST(code: string) {
      return toSourceCode('/tmp/foo.liquid', code).ast as LiquidHtmlNode;
    }

    it('should return name if no valid annotations are present in definition', async () => {
      const ast = toAST(`
        {% doc %}
          just a description
          @undefined asdf
        {% enddoc %}
      `);

      const getLiquidDocDefinitions = makeGetLiquidDocDefinitions();
      const result = await getLiquidDocDefinitions(ast, 'product-card');
      expect(result).to.deep.equal({
        name: 'product-card',
        parameters: [],
      });
    });

    it('should extract name, description and type from param annotations', async () => {
      const ast = toAST(`
        {% doc %}
          @param {String} firstParam - The first param
          @param {Number} secondParam - The second param
          @param paramWithNoType - param with no type
          @param paramWithOnlyName
        {% enddoc %}
      `);

      const getLiquidDocDefinitions = makeGetLiquidDocDefinitions();
      const result = await getLiquidDocDefinitions(ast, 'product-card');
      expect(result).to.deep.equal({
        name: 'product-card',
        parameters: [
          {
            name: 'firstParam',
            description: 'The first param',
            type: 'String',
          },
          {
            name: 'secondParam',
            description: 'The second param',
            type: 'Number',
          },
          {
            name: 'paramWithNoType',
            description: 'param with no type',
            type: null,
          },
          {
            name: 'paramWithOnlyName',
            description: '',
            type: null,
          },
        ],
      });
    });
  });
});
