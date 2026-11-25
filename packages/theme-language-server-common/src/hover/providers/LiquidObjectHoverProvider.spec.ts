import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap, ObjectEntry } from '@shopify/theme-check-common';

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

  it.each([
    ['variant', '{{ variant█ }}'],
    ['style', '{% assign style = variant %}{{ style█ }}'],
  ])('retains enum values when hovering %s', async (name, source) => {
    await expect(provider).to.hover(
      {
        relativePath: 'snippets/text.liquid',
        source: `{% doc %}\n@param {'Heading' | "Small"} variant\n{% enddoc %}\n${source}`,
      },
      `### ${name}: \`'Heading' | "Small"\``,
    );
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

  describe('when a theme block schema defines settings', () => {
    beforeEach(() => {
      provider = blockFileProvider();
    });

    it('hovers a setting ID as a plain variable with its schema type', async () => {
      await expect(provider).to.hover(
        articleCard('{{ backgr█ound_color }}'),
        '### background_color: `string`',
      );
    });

    it('gives the plain variable and block.settings alias the same type', async () => {
      const imageTitle = expect.stringMatching(/^### image: `image`(\n|$)/);

      await expect(provider).to.hover(articleCard('{{ ima█ge }}'), imageTitle);
      await expect(provider).to.hover(articleCard('{{ block.settings.ima█ge }}'), imageTitle);
    });

    it('uses the schema type for a same-named LiquidDoc parameter', async () => {
      await expect(provider).to.hover(
        articleCard('{{ ima█ge }}', '@param {object} image'),
        IMAGE_HOVER,
      );
    });

    it('does not hover the setting type value as a variable', async () => {
      await expect(provider).to.hover(articleCard('{{ color_back█ground }}'), null);
    });

    it.each(['sections/article-card.liquid', 'snippets/article-card.liquid'])(
      'does not hover setting IDs as variables in %s',
      async (relativePath) => {
        await expect(provider).to.hover(
          { ...articleCard('{{ backgr█ound_color }}'), relativePath },
          null,
        );
      },
    );
  });

  describe('when a theme block uses the built-in content parameter', () => {
    beforeEach(() => {
      provider = blockFileProvider();
    });

    it('hovers content as a string variable without a schema or LiquidDoc', async () => {
      await expect(provider).to.hover(
        { relativePath: 'blocks/card.liquid', source: '{{ cont█ent }}' },
        '### content: `string`',
      );
    });

    it('hovers block.content as a string property', async () => {
      await expect(provider).to.hover(
        { relativePath: 'blocks/card.liquid', source: '{{ block.cont█ent }}' },
        '### content: `string`',
      );
    });

    it.each([
      'sections/card.liquid',
      'snippets/card.liquid',
      'shop/blocks/theme/sections/card.liquid',
      'shop/myblocks/card.liquid',
    ])('does not hover content as a variable in %s', async (relativePath) => {
      await expect(provider).to.hover({ relativePath, source: '{{ cont█ent }}' }, null);
    });

    it.each([
      'sections/main.liquid',
      'shop/blocks/theme/sections/main.liquid',
      'shop/myblocks/main.liquid',
    ])('does not hover content on the section block object in %s', async (relativePath) => {
      await expect(provider).to.hover(
        {
          relativePath,
          source: '{% for block in section.blocks %}{{ block.cont█ent }}{% endfor %}',
        },
        null,
      );
    });
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

const IMAGE_HOVER = [
  '### image: `image`',
  'image description',
  '',
  '---',
  '',
  '[Shopify Reference](https://shopify.dev/docs/api/liquid/objects/image)',
].join('\n');

const blockSettingsObjects: ObjectEntry[] = [
  {
    name: 'block',
    access: { global: false, parents: [], template: [] },
    return_type: [],
    properties: [{ name: 'settings', return_type: [{ type: 'untyped', name: '' }] }],
  },
  {
    name: 'section',
    access: { global: false, parents: [], template: [] },
    return_type: [],
    properties: [
      { name: 'settings', return_type: [{ type: 'untyped', name: '' }] },
      { name: 'blocks', return_type: [{ type: 'array', array_value: 'block' }] },
    ],
  },
  {
    name: 'image',
    description: 'image description',
    access: { global: false, parents: [], template: [] },
    return_type: [],
  },
];

function blockFileProvider() {
  return new HoverProvider(
    new DocumentManager(),
    {
      filters: async () => [],
      objects: async () => blockSettingsObjects,
      liquidDrops: async () => blockSettingsObjects,
      tags: async () => [],
      systemTranslations: async () => ({}),
    },
    async () => ({}) as MetafieldDefinitionMap,
  );
}

function articleCard(body: string, docParam?: string) {
  return {
    relativePath: 'blocks/article-card.liquid',
    source: [
      docParam ? `{% doc %}\n  ${docParam} - Card image\n{% enddoc %}` : '',
      `<div class="article-card">${body}</div>`,
      '{% schema %}',
      JSON.stringify({
        name: 'Article card',
        settings: [
          { type: 'color_background', id: 'background_color', label: 'Background' },
          { type: 'image_picker', id: 'image', label: 'Image' },
        ],
      }),
      '{% endschema %}',
    ].join('\n'),
  };
}
