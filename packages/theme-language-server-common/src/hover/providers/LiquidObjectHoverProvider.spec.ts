import { MetafieldDefinitionMap, ObjectEntry } from '@shopify/theme-check-common';
import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

describe('Module: LiquidObjectHoverProvider', async () => {
  let provider: HoverProvider;

  beforeEach(async () => {
    const _objects: ObjectEntry[] = [
      {
        name: 'product',
        description: 'product description',
        return_type: [],
        properties: [
          {
            name: 'featured_image',
            return_type: [{ type: 'image', name: '' }],
          },
          {
            name: 'title',
            return_type: [{ type: 'string', name: '' }],
          },
          { name: 'metafields' },
        ],
      },
      {
        name: 'all_products',
        return_type: [{ type: 'array', array_value: 'product' }],
      },
      {
        name: 'paginate',
        access: { global: false, parents: [], template: [] },
        return_type: [],
      },
      {
        name: 'forloop',
        access: { global: false, parents: [], template: [] },
        return_type: [],
      },
      {
        name: 'tablerowloop',
        access: { global: false, parents: [], template: [] },
        return_type: [],
      },
      {
        name: 'image',
        description: 'image description',
        access: { global: false, parents: [], template: [] },
      },
      {
        name: 'section',
        access: { global: false, parents: [], template: [] },
      },
      {
        name: 'block',
        access: { global: false, parents: [], template: [] },
      },
      {
        name: 'app',
        access: { global: false, parents: [], template: [] },
      },
      {
        name: 'predictive_search',
        access: { global: false, parents: [], template: [] },
      },
      {
        name: 'recommendations',
        access: { global: false, parents: [], template: [] },
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

    provider = new HoverProvider(
      new DocumentManager(),
      {
        filters: async () => [],
        objects: async () => _objects,
        liquidDrops: async () => _objects,
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      async (_uri: string) => {
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
    );
  });

  it('should return the hover description of the object', async () => {
    const contexts = [
      '{{ pro█duct }}',
      '{{ product█ }}',
      '{% echo product█ %}',
      '{% liquid\n echo product█ %}',
      '{% assign x = product %}{{ x█ }}',
      '{% for x in all_products %}{{ x█ }}{% endfor %}',
      '{% assign x = all_products[0] %}{{ x█ }}',
      '{% assign x█ = all_products[0] %}',
      // '{% for x█ in all_products %}{{ x }}{% endfor %}', // not supported yet...
    ];
    for (const context of contexts) {
      await expect(provider).to.hover(context, expect.stringContaining('product description'));
      await expect(provider).to.hover(context, expect.stringMatching(/##* \w+: `product`/));
    }
  });

  it('should support paginate inside paginate tags', async () => {
    const context = `
      {% paginate all_products by 5 %}
        {{ paginate█ }}
      {% endpaginate %}
    `;
    await expect(provider).to.hover(context, expect.stringMatching(/##* paginate: `paginate`/));
    await expect(provider).to.hover('{{ paginate█ }}', null);
  });

  it('should support form inside form tags', async () => {
    const context = `
      {% form all_products by 5 %}
        {{ form█ }}
      {% endform %}
    `;
    await expect(provider).to.hover(context, expect.stringMatching(/##* form: `form`/));
    await expect(provider).to.hover('{{ form█ }}', null);
  });

  it('should support forloop inside for tags', async () => {
    const context = `
      {% for p in all_products %}
        {{ forloop█ }}
      {% endfor %}
    `;
    await expect(provider).to.hover(context, expect.stringMatching(/##* forloop: `forloop`/));
    await expect(provider).to.hover('{{ forloop█ }}', null);
  });

  it('should support tablerowloop inside tablerow tags', async () => {
    const context = `
      {% tablerow p in all_products %}
        {{ tablerowloop█ }}
      {% endtablerow %}
    `;
    await expect(provider).to.hover(
      context,
      expect.stringMatching(/##* tablerowloop: `tablerowloop`/),
    );
    await expect(provider).to.hover('{{ tablerowloop█ }}', null);
  });

  it('should support {% layout none %}', async () => {
    await expect(provider).to.hover(
      `{% layout none█ %}`,
      expect.stringMatching(/##* none: `keyword`/),
    );
    await expect(provider).to.hover('{{ none█ }}', null);
  });

  it('should support {% increment var %}', async () => {
    await expect(provider).to.hover(
      `{% increment var█ %}`,
      expect.stringMatching(/##* var: `number`/),
    );
    await expect(provider).to.hover('{{ var█ }}', null);
  });

  it('should support {% decrement var %}', async () => {
    await expect(provider).to.hover(
      `{% decrement var█ %}`,
      expect.stringMatching(/##* var: `number`/),
    );
    await expect(provider).to.hover('{{ var█ }}', null);
  });

  it('should support contextual objects by relative path', async () => {
    const contexts: [string, string][] = [
      ['section', 'sections/my-section.liquid'],
      ['block', 'blocks/my-block.liquid'],
      ['predictive_search', 'sections/predictive-search.liquid'],
      ['recommendations', 'sections/recommendations.liquid'],
      ['app', 'blocks/recommendations.liquid'],
      ['app', 'snippets/recommendations.liquid'],
    ];
    for (const [object, relativePath] of contexts) {
      const source = `{{ ${object}█ }}`;
      await expect(provider).to.hover(
        { source, relativePath },
        expect.stringContaining(`## ${object}`),
      );
      await expect(provider).to.hover({ source, relativePath: 'file.liquid' }, null);
    }
  });

  it('should support metafields', async () => {
    await expect(provider).to.hover(
      '{{ product.metafields.custom█ }}',
      '### custom: `product_metafield_custom`',
    );
    await expect(provider).to.hover(
      '{{ product.metafields.custom.color█ }}',
      '### color: `metafield_color`\nthe color of the product',
    );
  });

  it('should return null when hovering over an undefined variable', async () => {
    await expect(provider).to.hover(`{{ unknown█ }}`, null);
  });

  it('should return something if the thing is knowingly untyped', async () => {
    await expect(provider).to.hover(
      `{% assign src = product.featured_image.src %}{{ src█ }}`,
      `### src: \`untyped\``,
    );
  });

  it('should still return null when hovering over an unknown variable out of scope', async () => {
    await expect(provider).to.hover(
      `{% for p in all_products %}
        {{ forloop█ }}
      {% endfor %}
      {{ forloop }}`,
      expect.stringMatching(/##* forloop: `forloop`/),
    );
    await expect(provider).to.hover(
      `{% for p in all_products %}
        {{ forloop }}
      {% endfor %}
      {{ forloop█ }}`,
      null,
    );
  });
});
