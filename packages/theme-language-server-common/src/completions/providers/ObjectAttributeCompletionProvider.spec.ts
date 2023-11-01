import { describe, beforeEach, it, expect, vi } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { SettingsSchemaJSONFile } from '../../settings';

describe('Module: ObjectAttributeCompletionProvider', async () => {
  let provider: CompletionsProvider;
  let settingsProvider: any;

  beforeEach(async () => {
    settingsProvider = vi.fn().mockResolvedValue([]);
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [
          { name: 'split', return_type: [{ type: 'array', array_value: 'string' }] },
          { name: 'upcase', return_type: [{ type: 'string', name: '' }] },
          { name: 'downcase', return_type: [{ type: 'string', name: '' }] },
        ],
        objects: async () => [
          {
            name: 'settings',
            properties: [],
          },
          {
            name: 'global_default',
            properties: [{ name: 'prop1' }, { name: 'prop2' }],
          },
          {
            name: 'global_access',
            access: {
              global: true,
              parents: [],
              template: [],
            },
            properties: [{ name: 'prop3' }, { name: 'prop4' }],
          },
          {
            name: 'product',
            access: {
              global: false,
              parents: [],
              template: ['product'],
            },
            properties: [
              {
                name: 'images',
                return_type: [
                  {
                    type: 'array',
                    array_value: 'image',
                  },
                ],
              },
            ],
          },
          {
            name: 'image',
            access: {
              global: false, // image is a type, but not a global variable
              parents: [],
              template: [],
            },
            properties: [
              { name: 'src', return_type: [{ type: 'string', name: '' }] },
              { name: 'width', return_type: [{ type: 'number', name: '' }] },
              { name: 'height', return_type: [{ type: 'number', name: '' }] },
            ],
          },
        ],
        tags: async () => [],
      },
      getThemeSettingsSchemaForURI: settingsProvider,
    });
  });

  it('does not complete number lookups', async () => {
    await expect(provider).to.complete('{{ product[01█ }}', []);
  });

  it('does not complete boolean lookups', async () => {
    await expect(provider).to.complete('{{ product[tr█ }}', []);
  });

  it('does complete string lookups', async () => {
    await expect(provider).to.complete('{{ product["█ }}', ['images']);
  });

  it('has nothing to complete for numbers', async () => {
    const sources = [
      `{% assign x = 10 %}
       {{ x.█ }}`,
      `{% for x in (0..5) %}
         {{ x.█ }}
       {% endfor %}`,
    ];
    for (const source of sources) {
      await expect(provider).to.complete(source, []);
    }
  });

  describe('Case: global variables', () => {
    it('returns the properties of global variables', async () => {
      await expect(provider).to.complete('{{ global_default.█ }}', ['prop1', 'prop2']);
      await expect(provider).to.complete('{{ global_access.█ }}', ['prop3', 'prop4']);
    });

    it('returns the properties of non-global variables that could be global per template', async () => {
      await expect(provider).to.complete('{{ product.█ }}', ['images']);
    });

    it('does not complete the properties of a non-global type', async () => {
      await expect(provider).to.complete('{{ image.█ }}', []);
    });
  });

  describe('Case: scoping and inference', () => {
    it('returns the properties of a resolved variable', async () => {
      const source = `
        {% assign x = global_default %}
        {{ x.p█ }}
      `;
      await expect(provider).to.complete(source, ['prop1', 'prop2']);
    });

    it('returns the properties of the infered type of a deep lookup', async () => {
      const source = `
        {% assign x = product.images.first %}
        {{ x.s█ }}
      `;
      await expect(provider).to.complete(source, ['src']);
    });

    it('returns the properties of the infered type of a series of threaded types', async () => {
      const source = `
        {% assign x = product %}
        {% assign y = x.images %}
        {% assign z = y.first %}
        {{ z.s█ }}
      `;
      await expect(provider).to.complete(source, ['src']);
    });

    it('returns the properties of the infered type of a series of threaded types (liquid tag)', async () => {
      const source = `
        {% liquid
          assign x = product
          assign y = x.images
          assign z = y.first
          echo z.s█
        %}
      `;
      await expect(provider).to.complete(source, ['src']);
    });

    describe('When: inside a for/tablerow loop', () => {
      it('returns the properties of the array_value of the array', async () => {
        for (const tag of ['for', 'tablerow']) {
          const source = `
            {% # x is global_default %}
            {% assign x = global_default %}

            {% # x is image only in for loop %}
            {% ${tag} x in product.images %}
              {{ x.s█ }}
            {% end${tag} %}
          `;
          await expect(provider, source).to.complete(source, ['src']);
        }
      });
    });

    it('returns the properties of the last known type of a thing', async () => {
      const source = `
        {% # x is global_default %}
        {% assign x = global_default %}

        {% # x is image only in for loop %}
        {% for x in product.images %}
          {{ x.src }}
        {% endfor %}

        {% # x is still global_default %}
        {{ x.█ }}
      `;
      await expect(provider).to.complete(source, ['prop1', 'prop2']);
    });
  });

  describe('Case: capture', () => {
    it('returns the properties of a captured string', async () => {
      const source = `
        {% capture x %}
          ...
        {% endcapture %}
        {{ x.█ }}
      `;
      await expect(provider).to.complete(source, ['size']);
    });
  });

  describe('Case: array parent type', () => {
    it('returns the properties of a created array from filter', async () => {
      const source = `
        {% assign x = '123' | split: '' %}
        {{ x.█ }}
      `;
      await expect(provider).to.complete(source, ['first', 'last', 'size']);
    });

    it('returns the properties of the array_value', async () => {
      const sources = [
        `{% assign x = product.images %}
         {{ x.first.█ }}`,
        `{% assign x = product.images %}
         {{ x.last.█ }}`,
        `{% assign x = product.images %}
         {{ x[0].█ }}`,
        `{% assign x = product.images %}
         {{ x[1].█ }}`,
        `{% assign x = product.images %}
         {% assign lookup = 0 %}
         {{ x[lookup].█ }}`,
      ];
      for (const source of sources) {
        await expect(provider, source).to.complete(source, ['height', 'src', 'width']);
      }
    });
  });

  describe('Case: infered filter return type', () => {
    it('should return the properties of a string return type', async () => {
      const source = `
        {% assign x = product.images.first.src | upcase | downcase %}
        {{ x.█ }}
      `;
      await expect(provider).to.complete(source, ['size']);
    });

    it('should return the properties of an array return type', async () => {
      const source = `
        {% assign x = product.images.first.src | split: ',' %}
        {{ x.█ }}
      `;
      await expect(provider).to.complete(source, ['first', 'last', 'size']);
    });
  });

  describe('Case: global settings', () => {
    it('should complete basic settings by id as expected', async () => {
      const settings: SettingsSchemaJSONFile = [
        {
          name: 'Category',
          settings: [
            {
              type: 'product',
              id: 'my_product_setting',
              label: 'Product',
            },
          ],
        },
      ];
      settingsProvider.mockResolvedValue(settings);

      const source = `
        {{ settings.█ }}
      `;
      await expect(provider).to.complete(source, ['my_product_setting']);
    });
  });
});
