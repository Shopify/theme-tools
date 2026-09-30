import { describe, expect, it, vi } from 'vitest';
import { ValidBlockArgumentTypes } from './index';
import { check, highlightedOffenses } from '../../test';
import {
  blockSource,
  INVALID_SCHEMA_BLOCK,
  liquidDocBlock,
  runBlockCallCheck,
} from '../../test/block-fixtures';

const TYPED_BLOCK = blockSource(
  [
    { id: 'heading', type: 'text' },
    { id: 'count', type: 'number' },
    { id: 'product', type: 'product' },
    { id: 'products', type: 'product_list' },
  ],
  ['@param {number} developer_count - Developer-only count'],
);

const LIQUID_DOC_ONLY_BLOCK = liquidDocBlock([
  '@param {number} developer_count - Developer-only count',
]);

describe('ValidBlockArgumentTypes', () => {
  describe('call-site values', () => {
    it('checks literals against schema-derived primitive types', async () => {
      const template = "{% block 'card', heading: 42, count: 'many' %}{% endblock %}";
      const offenses = await run(template, TYPED_BLOCK);

      expect(offenses).toMatchObject([
        { message: "Type mismatch for argument 'heading': expected string, got number" },
        { message: "Type mismatch for argument 'count': expected number, got string" },
      ]);
      expect(highlightedOffenses({ 'templates/test.liquid': template }, offenses)).toEqual([
        '42',
        "'many'",
      ]);
    });

    it('accepts literals that match schema-derived types', async () => {
      const offenses = await run(
        "{% block 'card', heading: 'Title', count: 2, product: product, products: products %}{% endblock %}",
        TYPED_BLOCK,
      );

      expect(offenses).toEqual([]);
    });

    it('checks literals against LiquidDoc-only developer parameter types', async () => {
      const offenses = await run(
        "{% block 'card', developer_count: 'many' %}{% endblock %}",
        TYPED_BLOCK,
      );

      expect(offenses).toMatchObject([
        {
          message: "Type mismatch for argument 'developer_count': expected number, got string",
        },
      ]);
    });

    it('checks LiquidDoc-only parameter types from a schema-less block', async () => {
      const offenses = await run(
        "{% block 'card', developer_count: 'many' %}{% endblock %}",
        LIQUID_DOC_ONLY_BLOCK,
      );

      expect(offenses).toMatchObject([
        {
          message: "Type mismatch for argument 'developer_count': expected number, got string",
        },
      ]);
    });

    it('checks resource and list settings exactly', async () => {
      const offenses = await run(
        "{% block 'card', product: 'handle', products: ['one', 'two'] %}{% endblock %}",
        TYPED_BLOCK,
      );

      expect(offenses).toMatchObject([
        { message: "Type mismatch for argument 'product': expected product, got string" },
        { message: "Type mismatch for argument 'products': expected product[], got string[]" },
      ]);
    });

    it('requires arrays to match the element type exactly', async () => {
      const offenses = await run(
        "{% block 'card', products: ['one', 2] %}{% endblock %}",
        TYPED_BLOCK,
      );

      expect(offenses).toMatchObject([
        { message: "Type mismatch for argument 'products': expected product[], got mixed[]" },
      ]);
    });

    it('does not speculate about variable lookups or empty and partly unknown arrays', async () => {
      const offenses = await run(
        "{% block 'card', product: selected_product, products: [], heading: [selected, 'x'] %}{% endblock %}",
        TYPED_BLOCK,
      );

      expect(offenses).toEqual([]);
    });

    it('accepts any literal for an object parameter', async () => {
      const offenses = await run(
        "{% block 'card', a: 'x', b: 1, c: (1..2), d: ['x'] %}{% endblock %}",
        liquidDocBlock([
          '@param {object} a',
          '@param {object} b',
          '@param {object} c',
          '@param {object} d',
        ]),
      );

      expect(offenses).toEqual([]);
    });

    it('accepts any scalar for a boolean parameter but not a range or array', async () => {
      const offenses = await run(
        "{% block 'card', a: 'yes', b: 1, c: nil, d: (1..2), e: [true] %}{% endblock %}",
        liquidDocBlock([
          '@param {boolean} a',
          '@param {boolean} b',
          '@param {boolean} c',
          '@param {boolean} d',
          '@param {boolean} e',
        ]),
      );

      expect(offenses).toMatchObject([
        { message: "Type mismatch for argument 'd': expected boolean, got object" },
        { message: "Type mismatch for argument 'e': expected boolean, got boolean[]" },
      ]);
    });

    it('checks explicit content as a string without LiquidDoc', async () => {
      const offenses = await run("{% block 'card', content: 42 %}{% endblock %}", blockSource([]));

      expect(offenses).toMatchObject([
        { message: "Type mismatch for argument 'content': expected string, got number" },
      ]);
    });

    it('checks explicit content as a string when the schema content setting is not', async () => {
      const offenses = await run(
        "{% block 'card', content: 42 %}{% endblock %}",
        blockSource([{ id: 'content', type: 'number' }]),
      );

      expect(offenses).toMatchObject([
        { message: "Type mismatch for argument 'content': expected string, got number" },
      ]);
    });

    it.each([
      ['missing target', undefined],
      ['invalid target schema', INVALID_SCHEMA_BLOCK],
    ])('does not report type mismatches for an unreadable %s', async (_name, block) => {
      const offenses = await run("{% block 'card', heading: 42 %}{% endblock %}", block);

      expect(offenses).toEqual([]);
    });
  });

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

  describe('merged declarations', () => {
    it('accepts exact and less-specific compatible LiquidDoc types', async () => {
      const offenses = await definitions(
        blockSource(
          [
            { id: 'product', type: 'product' },
            { id: 'products', type: 'product_list' },
          ],
          ['@param {object} [product] - Product', '@param {product[]} [products] - Products'],
        ),
      );

      expect(offenses).toEqual([]);
    });

    it('compares resource and list LiquidDoc types exactly', async () => {
      const offenses = await definitions(
        blockSource(
          [
            { id: 'product', type: 'product' },
            { id: 'products', type: 'product_list' },
            { id: 'collections', type: 'collection_list' },
          ],
          [
            '@param {collection} [product] - Product',
            '@param {product} [products] - Products',
            '@param {product[]} [collections] - Collections',
          ],
        ),
      );

      expect(offenses.map((offense) => offense.message)).toEqual([
        "The schema setting 'product' has Liquid type 'product', but LiquidDoc declares 'collection'. The schema setting type is authoritative.",
        "The schema setting 'products' has Liquid type 'product[]', but LiquidDoc declares 'product'. The schema setting type is authoritative.",
        "The schema setting 'collections' has Liquid type 'collection[]', but LiquidDoc declares 'product[]'. The schema setting type is authoritative.",
      ]);
    });

    it('points incompatible type declarations at the LiquidDoc type', async () => {
      const source = blockSource(
        [{ id: 'heading', type: 'text' }],
        ['@param {number} [heading] - Heading'],
      );
      const offenses = await definitions(source);

      expect(offenses).toMatchObject([
        {
          message:
            "The schema setting 'heading' has Liquid type 'string', but LiquidDoc declares 'number'. The schema setting type is authoritative.",
        },
      ]);
      expect(highlightedOffenses({ 'blocks/card.liquid': source }, offenses)).toEqual(['{number}']);
    });

    it('accepts an optional LiquidDoc declaration of a schema setting', async () => {
      const offenses = await definitions(
        blockSource([{ id: 'heading', type: 'text' }], ['@param {string} [heading] - Heading']),
      );

      expect(offenses).toEqual([]);
    });

    it('keeps the schema type of a setting that LiquidDoc declares as a string enum', async () => {
      const block = blockSource(
        [{ id: 'variant', type: 'text' }],
        ["@param {'heading' | 'small'} [variant] - Variant"],
      );

      expect(await definitions(block)).toEqual([]);
      expect(await run("{% block 'card', variant: 'body' %}{% endblock %}", block)).toEqual([]);
      expect(await run("{% block 'card', variant: 42 %}{% endblock %}", block)).toMatchObject([
        { message: "Type mismatch for argument 'variant': expected string, got number" },
      ]);
    });

    it('does not speculate about omitted LiquidDoc or unmapped schema types', async () => {
      const offenses = await definitions(
        blockSource([{ id: 'item', type: 'metaobject' }], ['@param [item] - Item']),
      );

      expect(offenses).toEqual([]);
    });

    it('requires LiquidDoc content types to remain string-compatible', async () => {
      const offenses = await definitions(blockSource([], ['@param {number} [content] - Body']));

      expect(offenses).toMatchObject([
        {
          message:
            "The built-in parameter 'content' has Liquid type 'string', but LiquidDoc declares 'number'. The built-in parameter type is authoritative.",
        },
      ]);
    });

    it.each([
      ['without LiquidDoc', []],
      ['with a LiquidDoc string echo', ['@param {string} [content] - Body']],
    ])(
      'leaves a non-string schema content setting %s to ValidBlockContentSettingType',
      async (_name, params) => {
        const offenses = await definitions(
          blockSource([{ id: 'content', type: 'number' }], params),
        );

        expect(offenses).toEqual([]);
      },
    );

    it('accepts a string-compatible schema content setting', async () => {
      const offenses = await definitions(blockSource([{ id: 'content', type: 'text' }]));

      expect(offenses).toEqual([]);
    });
  });
});

function run(template: string, block: string | undefined) {
  return runBlockCallCheck(ValidBlockArgumentTypes, template, block);
}

function definitions(source: string) {
  return check({ 'blocks/card.liquid': source }, [ValidBlockArgumentTypes]);
}
