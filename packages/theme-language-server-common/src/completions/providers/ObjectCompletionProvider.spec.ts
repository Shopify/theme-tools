import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { MetafieldDefinitionMap, ObjectEntry } from '@shopify/theme-check-common';

describe('Module: ObjectCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    const _objects: ObjectEntry[] = [
      { name: 'all_products' },
      { name: 'global' },
      {
        name: 'section',
        access: {
          global: false,
          template: [],
          parents: [],
        },
      },
      {
        name: 'block',
        access: {
          global: false,
          template: [],
          parents: [],
        },
      },
      {
        name: 'predictive_search',
        access: {
          global: false,
          template: [],
          parents: [],
        },
      },
      {
        name: 'recommendations',
        access: {
          global: false,
          template: [],
          parents: [],
        },
      },
      {
        name: 'app',
        access: {
          global: false,
          template: [],
          parents: [],
        },
      },
      {
        name: 'product',
        properties: [
          {
            name: 'metafields',
          },
        ],
      },
      {
        name: 'metafield',
        access: {
          global: false,
          template: [],
          parents: [],
        },
        properties: [
          {
            name: 'type',
            description: 'the type of the metafield',
            return_type: [{ type: 'string', name: '' }],
          },
          {
            name: 'value',
            description: 'the value of the metafield',
            return_type: [{ type: 'untyped', name: '' }],
          },
        ],
      },
    ];

    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [],
        objects: async () => _objects,
        liquidDrops: async () => _objects,
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      getMetafieldDefinitions: async (_rootUri: string) => {
        return {
          article: [],
          blog: [],
          collection: [],
          company: [],
          company_location: [],
          location: [],
          market: [],
          order: [],
          page: [],
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
          variant: [],
          shop: [],
        } as MetafieldDefinitionMap;
      },
    });
  });

  it('should complete variable lookups', async () => {
    const contexts = [
      `{{ a█`,
      `{% echo a█ %}`,
      `{% assign x = a█ %}`,
      `{% for a in a█ %}`,
      `{% for a in b reversed limit: a█ %}`,
      `{% paginate b by a█ %}`,
      `{% paginate b by col, window_size: a█ %}`,
      `{% if a█ %}`,
      `{% if a > a█ %}`,
      `{% if a > b or a█ %}`,
      `{% if a > b or c > a█ %}`,
      `{% elsif a > a█ %}`,
      `{% when a█ %}`,
      `{% when a, a█ %}`,
      `{% cycle a█ %}`,
      `{% cycle 'foo', a█ %}`,
      `{% cycle 'foo': a█ %}`,
      `{% render 'snip', var: a█ %}`,
      `{% render 'snip' for a█ as item %}`,
      `{% render 'snip' with a█ as name %}`,
      `{% for x in (1..a█) %}`,
      // `{% paginate a█ by 50 %}`,
      `<a-{{ a█ }}`,
      `<a data-{{ a█ }}`,
      `<a data={{ a█ }}`,
      `<a data="{{ a█ }}"`,
      `<a data='x{{ a█ }}'`,
    ];
    await Promise.all(
      contexts.map((context) => expect(provider, context).to.complete(context, ['all_products'])),
    );
  });

  it('should complete variable lookups (placeholder mode)', async () => {
    const contexts = [
      `{{ █`,
      `{% echo █ %}`,
      `{% assign x = █ %}`,
      `{% for a in █ %}`,
      `{% for a in b reversed limit: █ %}`,
      `{% paginate b by █ %}`,
      `{% paginate b by col, window_size: █ %}`,
      `{% if █ %}`,
      `{% if a > █ %}`,
      `{% if a > b or █ %}`,
      `{% if a > b or c > █ %}`,
      `{% elsif a > █ %}`,
      `{% when █ %}`,
      `{% when a, █ %}`,
      `{% cycle █ %}`,
      `{% cycle 'foo', █ %}`,
      `{% cycle 'foo': █ %}`,
      `{% render 'snip', var: █ %}`,
      `{% render 'snip' for █ as item %}`,
      `{% render 'snip' with █ as name %}`,
      `{% for x in (1..█) %}`,
      // `{% paginate █ by 50 %}`,
      `<a-{{ █ }}`,
      `<a data-{{ █ }}`,
      `<a data={{ █ }}`,
      `<a data="{{ █ }}"`,
      `<a data='x{{ █ }}'`,
    ];

    await Promise.all(
      contexts.map((context) =>
        expect(provider, context).to.complete(context, ['all_products', 'global', 'product']),
      ),
    );
  });

  it('should complete contextual variables', async () => {
    const contexts: [string, string][] = [
      ['{% paginate all_products by 5 %}{{ pagi█ }}{% endpaginate %}', 'paginate'],
      ['{% form "cart" %}{{ for█ }}{% endform %}', 'form'],
      ['{% for p in all_products %}{{ for█ }}{% endfor %}', 'forloop'],
      ['{% tablerow p in all_products %}{{ tablerow█ }}{% endtablerow %}', 'tablerowloop'],
      ['{% layout non█ %}', 'none'],
      ['{% increment var %}{{ var█ }}', 'var'],
      ['{% decrement var %}{{ var█ }}', 'var'],
      ['{% assign var = 1 %}{{ var█ }}', 'var'],
    ];
    for (const [context, expected] of contexts) {
      await expect(provider, context).to.complete(context, [expected]);
      const outOfContext = `{{ ${expected}█ }}`;
      await expect(provider, outOfContext).to.complete(outOfContext, []);
    }
  });

  it('should complete relative-path-dependent contextual variables', async () => {
    const contexts: [string, string][] = [
      ['section', 'sections/main-product.liquid'],
      ['block', 'blocks/my-block.liquid'],
      ['predictive_search', 'sections/predictive-search.liquid'],
      ['recommendations', 'sections/recommendations.liquid'],
    ];
    for (const [object, relativePath] of contexts) {
      const source = `{{ ${object}█ }}`;
      await expect(provider, source).to.complete({ source, relativePath }, [object]);
      await expect(provider, source).to.complete({ source, relativePath: 'file.liquid' }, []);
    }
  });

  it('should complete block-level contextual variables in snippets when in app mode', async () => {
    const appModeProvider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: provider.themeDocset,
      getMetafieldDefinitions: async () =>
        ({
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
        }) as MetafieldDefinitionMap,
      getModeForURI: async () => 'app',
    });

    const blockLevelObjects = ['section', 'block', 'recommendations', 'app'];
    for (const object of blockLevelObjects) {
      const source = `{{ ${object}█ }}`;
      await expect(appModeProvider, source).to.complete(
        { source, relativePath: 'snippets/my-snippet.liquid' },
        expect.arrayContaining([expect.objectContaining({ label: object })]),
      );
    }
  });

  it('should not complete block-level contextual variables in snippets when in theme mode', async () => {
    const source = `{{ section█ }}`;
    await expect(provider, source).to.complete(
      { source, relativePath: 'snippets/my-snippet.liquid' },
      [],
    );
  });

  it('should not complete anything if there is nothing to complete', async () => {
    await expect(provider).to.complete('{% assign x = "█" %}', []);
  });

  it('should complete metafields defined by getMetafieldDefinitions', async () => {
    await expect(provider).to.complete('{% echo product.metafields.█ %}', ['custom']);
    await expect(provider).to.complete('{% echo product.metafields.custom.█ %}', ['color']);
    await expect(provider).to.complete('{% echo product.metafields.custom.color.█ %}', [
      'type',
      'value',
    ]);
  });
});
