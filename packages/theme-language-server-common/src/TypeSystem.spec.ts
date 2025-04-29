import {
  AssignMarkup,
  LiquidVariableOutput,
  NamedTags,
  NodeTypes,
  toLiquidHtmlAST,
} from '@shopify/liquid-html-parser';
import {
  MetafieldDefinitionMap,
  path as pathUtils,
  BasicParamTypes,
  ObjectEntry,
} from '@shopify/theme-check-common';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';
import { SettingsSchemaJSONFile } from './settings';
import { ArrayType, TypeSystem } from './TypeSystem';
import { isLiquidVariableOutput, isNamedLiquidTag } from './utils';

describe('Module: TypeSystem', () => {
  let typeSystem: TypeSystem;
  let settingsProvider: any;
  const literalContexts = [
    { value: `10`, type: 'number' },
    { value: `'string'`, type: 'string' },
    { value: `true`, type: 'boolean' },
    //      { value: `null`, type: 'untyped' },
  ];

  beforeEach(() => {
    const _objects: ObjectEntry[] = [
      {
        name: 'all_products',
        return_type: [{ type: 'array', array_value: 'product' }],
      },
      {
        name: 'product',
        access: {
          global: true,
          parents: [],
          template: [],
        },
        return_type: [],
        properties: [
          {
            name: 'featured_image',
            description: 'ze best image for ze product',
            return_type: [{ type: 'image', name: '' }],
          },
          {
            name: 'metafields',
            return_type: [{ type: 'untyped', name: '' }],
          },
        ],
      },
      {
        name: 'metafield',
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
      {
        name: 'settings',
        return_type: [],
        properties: [], // these should be populated dynamically
      },
      {
        name: 'predictive_search',
        access: { global: false, parents: [], template: [] },
        return_type: [],
      },
      {
        name: 'comment',
        access: { global: false, parents: [], template: [] },
        return_type: [],
      },
      {
        name: 'recommendations',
        access: { global: false, parents: [], template: [] },
        return_type: [],
      },
      {
        name: 'app',
        access: { global: false, parents: [], template: [] },
        return_type: [],
      },
      {
        name: 'section',
        access: { global: false, parents: [], template: [] },
        return_type: [],
        properties: [
          {
            name: 'settings',
            return_type: [{ type: 'untyped', name: '' }],
          },
        ],
      },
      {
        name: 'block',
        access: { global: false, parents: [], template: [] },
        return_type: [],
        properties: [
          {
            name: 'settings',
            return_type: [{ type: 'untyped', name: '' }],
          },
        ],
      },
      {
        name: 'locale',
        access: { global: false, parents: [], template: [] },
        return_type: [],
      },
    ];
    settingsProvider = vi.fn().mockResolvedValue([]);
    typeSystem = new TypeSystem(
      {
        tags: async () => [],
        objects: async () => _objects,
        liquidDrops: async () => _objects,
        filters: async () => [
          {
            name: 'size',
            return_type: [{ type: 'number', name: '' }],
          },
        ],
        systemTranslations: async () => ({}),
      },
      settingsProvider,
      async (_uri: string) => {
        return {
          article: [],
          blog: [],
          collection: [],
          company: [],
          company_location: [],
          location: [],
          market: [],
          order: [
            {
              key: 'prods',
              name: 'products',
              namespace: 'related',
              description: 'related products',
              type: {
                category: 'REFERENCE',
                name: 'list.product_reference',
              },
            },
          ],
          page: [],
          product: [
            {
              key: 'code',
              name: 'code',
              namespace: 'manufacturer',
              description: 'the code provided by the manufacturer',
              type: {
                category: 'TEXT',
                name: 'single_line_text_field',
              },
            },
            {
              key: 'id',
              name: 'id',
              namespace: 'manufacturer',
              description: 'the id provided by the manufacturer',
              type: {
                category: 'INTEGER',
                name: 'number_integer',
              },
            },
            {
              key: 'is_rare',
              name: 'is_rare',
              namespace: 'custom',
              description: 'is this product rare?',
              type: {
                category: 'BOOLEAN',
                name: 'boolean',
              },
            },
          ],
          variant: [],
          shop: [],
        } as MetafieldDefinitionMap;
      },
    );
  });

  it('should return the type of assign markup nodes (basic test)', async () => {
    for (const { value, type } of literalContexts) {
      const ast = toLiquidHtmlAST(`{% assign x = ${value} %}`);
      const assignMarkup = (ast as any).children[0].markup as AssignMarkup;
      const inferredType = await typeSystem.inferType(assignMarkup, ast, 'file:///file.liquid');
      expect(inferredType, value).to.equal(type);
    }
  });

  it('should return the type of other variables', async () => {
    for (const { value, type } of literalContexts) {
      const ast = toLiquidHtmlAST(`{% assign x = ${value} %}{% assign y = x %}`);
      const yVariable = (ast as any).children[1].markup as AssignMarkup;
      const inferredType = await typeSystem.inferType(yVariable, ast, 'file:///file.liquid');
      expect(inferredType).to.equal(type);
    }
  });

  it('should return the type of expressions', async () => {
    for (const { value, type } of literalContexts) {
      const ast = toLiquidHtmlAST(`{{ ${value} }}`);
      const output = ast.children[0] as LiquidVariableOutput;
      const variable = output.markup;
      if (typeof variable === 'string') throw new Error('expecting real deal');
      const expression = variable.expression;
      const inferredType = await typeSystem.inferType(expression, ast, 'file:///file.liquid');
      expect(inferredType, value).to.equal(type);
    }
  });

  it('should return the type of array variables', async () => {
    const ast = toLiquidHtmlAST(`{% assign x = all_products %}`);
    const xVariable = (ast as any).children[0].markup as AssignMarkup;
    const inferredType = await typeSystem.inferType(xVariable, ast, 'file:///file.liquid');
    expect(inferredType).to.eql({ kind: 'array', valueType: 'product' });
  });

  it('should return the type of object properties', async () => {
    const ast = toLiquidHtmlAST(`{% assign x = all_products[0].featured_image %}`);
    const xVariable = (ast as any).children[0].markup as AssignMarkup;
    const inferredType = await typeSystem.inferType(xVariable, ast, 'file:///file.liquid');
    expect(inferredType).to.equal('image');
  });

  it('should return the type of filtered variables', async () => {
    const ast = toLiquidHtmlAST(`{% assign x = all_products | size %}`);
    const xVariable = (ast as any).children[0].markup as AssignMarkup;
    const inferredType = await typeSystem.inferType(xVariable, ast, 'file:///file.liquid');
    expect(inferredType).to.equal('number');
  });

  describe('when using the default filter', () => {
    it('should return the type of the default value literal', async () => {
      const ast = toLiquidHtmlAST(`
        {% assign x = x | default: 10 %}
      `);
      const xVariable = (ast as any).children[0].markup as AssignMarkup;
      const inferredType = await typeSystem.inferType(xVariable, ast, 'file:///file.liquid');
      expect(inferredType).to.equal('number');
    });

    it('should return the type of the default value lookup', async () => {
      const ast = toLiquidHtmlAST(`
        {% assign d = product.featured_image %}
        {% assign x = unknown | default: d %}
      `);
      const xVariable = (ast as any).children[1].markup as AssignMarkup;
      const inferredType = await typeSystem.inferType(xVariable, ast, 'file:///file.liquid');
      expect(inferredType).to.equal('image');
    });
  });

  it('should return the type of variables in for loop', async () => {
    const ast = toLiquidHtmlAST(`{% for item in all_products %}{{ item }}{% endfor %}`);
    const forLoop = ast.children[0];
    assert(isNamedLiquidTag(forLoop, NamedTags.for) && forLoop.children?.length === 1);
    const branch = forLoop.children[0];
    assert(branch.type === NodeTypes.LiquidBranch);
    const variableOutput = branch.children[0];
    assert(isLiquidVariableOutput(variableOutput));
    const variable = variableOutput.markup;

    const inferredType = await typeSystem.inferType(variable, ast, 'file:///file.liquid');
    expect(inferredType).to.equal('product');
  });

  it('should patch the properties of settings when a schema is available', async () => {
    settingsProvider.mockResolvedValue([
      {
        name: 'category',
        settings: [
          {
            id: 'slide',
            label: 'Slide label',
            type: 'checkbox',
          },
          {
            id: 'my_font',
            label: 'my font',
            type: 'font_picker',
          },
        ],
      },
    ] as SettingsSchemaJSONFile);

    const contexts = [
      { id: 'slide', expectedType: 'boolean' },
      { id: 'my_font', expectedType: 'font' },
    ];
    for (const { id, expectedType } of contexts) {
      const ast = toLiquidHtmlAST(`{{ settings.${id} }}`);
      const variableOutput = ast.children[0];
      assert(isLiquidVariableOutput(variableOutput));
      const inferredType = await typeSystem.inferType(
        variableOutput.markup,
        ast,
        'file:///file.liquid',
      );
      expect(inferredType).to.eql(expectedType);
    }
  });

  it('should support section settings in section files', async () => {
    const sourceCode = `
      {{ section.settings.my_list }}
      {% schema %}
      {
        "name": "section-settings-example",
        "tag": "section",
        "settings": [
          {
            "id": "my_list",
            "label": "t:my-setting.label",
            "type": "product_list"
          }
        ]
      }
      {% endschema %}
    `;
    const ast = toLiquidHtmlAST(sourceCode);
    const variableOutput = ast.children[0];
    assert(isLiquidVariableOutput(variableOutput));
    const inferredType = await typeSystem.inferType(
      variableOutput.markup,
      ast,
      'file:///sections/my-section.liquid',
    );
    expect(inferredType).to.eql({ kind: 'array', valueType: 'product' } as ArrayType);
  });

  it('should support block settings in blocks files', async () => {
    const sourceCode = `
      {{ block.settings.my_list }}
      {% schema %}
      {
        "name": "section-settings-example",
        "tag": "section",
        "settings": [
          {
            "id": "my_list",
            "label": "t:my-setting.label",
            "type": "product_list"
          }
        ]
      }
      {% endschema %}
    `;
    const ast = toLiquidHtmlAST(sourceCode);
    const variableOutput = ast.children[0];
    assert(isLiquidVariableOutput(variableOutput));
    const inferredType = await typeSystem.inferType(
      variableOutput.markup,
      ast,
      'file:///blocks/my-section.liquid',
    );
    expect(inferredType).to.eql({ kind: 'array', valueType: 'product' } as ArrayType);
  });

  // TODO
  it.skip('should support narrowing the type of blocks', async () => {
    const sourceCode = `
      {% for block in section.blocks %}
        {% case block.type %}
          {% when 'slide' %}
            {{ block.settings.image }}
          {% else %}
        {% endcase }
        {% if block.type == 'slide' %}
          {{ block.settings.image }}
        {% endif %}
      {% endfor %}
      {% schema %}
      {
        "name": "Slideshow",
        "tag": "section",
        "class": "slideshow",
        "settings": [],
        "blocks": [
          {
            "name": "Slide",
            "type": "slide",
            "settings": [
              {
                "type": "image_picker",
                "id": "image",
                "label": "Image"
              }
            ]
          }
        ]
      }
      {% endschema %}
    `;
    const ast = toLiquidHtmlAST(sourceCode);
  });

  it('should support path-contextual variable types', async () => {
    let inferredType: string | ArrayType;
    const contexts: [string, string][] = [
      ['section', 'sections/my-section.liquid'],
      ['comment', 'sections/main-article.liquid'],
      ['block', 'blocks/my-block.liquid'],
      ['predictive_search', 'sections/predictive-search.liquid'],
      ['recommendations', 'sections/recommendations.liquid'],
      ['app', 'blocks/recommendations.liquid'],
      ['app', 'snippets/recommendations.liquid'],
      ['locale', 'layout/checkout.liquid'],
    ];
    for (const [object, path] of contexts) {
      const sourceCode = `{{ ${object} }}`;
      const ast = toLiquidHtmlAST(sourceCode);
      const variableOutput = ast.children[0];
      assert(isLiquidVariableOutput(variableOutput));
      inferredType = await typeSystem.inferType(
        variableOutput.markup,
        ast,
        // This will be different on Windows ^^
        pathUtils.normalize(URI.from({ scheme: 'file', path })),
      );
      expect(inferredType).to.eql(object);
      inferredType = await typeSystem.inferType(
        variableOutput.markup,
        ast,
        // This will be different on Windows ^^
        pathUtils.normalize(URI.from({ scheme: 'file', path: 'file.liquid' })),
      );
      expect(inferredType).to.eql('unknown');
    }
  });

  describe('LiquidDoc inferred type', () => {
    const liquidDocParamTypeToTypeMap = {
      [BasicParamTypes.String]: 'string',
      [BasicParamTypes.Number]: 'number',
      [BasicParamTypes.Boolean]: 'boolean',
      [BasicParamTypes.Object]: 'untyped',
      invalid: 'untyped',
    };

    Object.entries(liquidDocParamTypeToTypeMap).forEach(([docParamType, expectedType]) => {
      it(`should support basic liquid doc params type: ${docParamType}`, async () => {
        const sourceCode = `
          {% doc %}
            @param {${docParamType}} data - some data
          {% enddoc %}
          {{ data }}
        `;
        const ast = toLiquidHtmlAST(sourceCode);
        const variableOutput = ast.children[1];
        assert(isLiquidVariableOutput(variableOutput));
        const inferredType = await typeSystem.inferType(
          variableOutput.markup,
          ast,
          'file:///snippets/example.liquid',
        );
        expect(inferredType).to.eql(expectedType);
      });
    });

    it(`should support complex liquid doc params type: product`, async () => {
      const sourceCode = `
        {% doc %}
          @param {product} data - some data
        {% enddoc %}
        {{ data }}
      `;
      const ast = toLiquidHtmlAST(sourceCode);
      const variableOutput = ast.children[1];
      assert(isLiquidVariableOutput(variableOutput));
      const inferredType = await typeSystem.inferType(
        variableOutput.markup,
        ast,
        'file:///snippets/example.liquid',
      );
      expect(inferredType).to.eql('product');
    });
  });

  describe('metafieldDefinitionsObjectMap', async () => {
    it('should convert metafield definitions into types', async () => {
      const metafieldObjectMap = await typeSystem.metafieldDefinitionsObjectMap(
        'file:///any/file.liquid',
      );

      assert(metafieldObjectMap['product_metafields']);
      assert(metafieldObjectMap['product_metafield_custom']);
      assert(metafieldObjectMap['product_metafield_manufacturer']);
    });

    it('should group metafield definitions by namespace', async () => {
      const metafieldObjectMap = await typeSystem.metafieldDefinitionsObjectMap(
        'file:///any/file.liquid',
      );
      const properties = metafieldObjectMap['product_metafields'].properties;

      assert(properties);
      expect(properties).toHaveLength(2);
      expect(properties).toContainEqual(
        expect.objectContaining({
          name: 'custom',
          return_type: [{ type: 'product_metafield_custom', name: '' }],
        }),
      );
      expect(metafieldObjectMap['product_metafields'].properties).toContainEqual(
        expect.objectContaining({
          name: 'manufacturer',
          return_type: [{ type: 'product_metafield_manufacturer', name: '' }],
        }),
      );

      const manufacturerProperties =
        metafieldObjectMap['product_metafield_manufacturer'].properties;

      assert(manufacturerProperties);
      expect(manufacturerProperties).toHaveLength(2);

      expect(manufacturerProperties).toContainEqual(
        expect.objectContaining({
          name: 'code',
          return_type: [{ type: 'metafield_string', name: '' }],
        }),
      );
      expect(manufacturerProperties).toContainEqual(
        expect.objectContaining({
          name: 'id',
          return_type: [{ type: 'metafield_number', name: '' }],
        }),
      );

      const customProperties = metafieldObjectMap['product_metafield_custom'].properties;

      assert(customProperties);
      expect(customProperties).toHaveLength(1);

      expect(customProperties).toContainEqual(
        expect.objectContaining({
          name: 'is_rare',
          return_type: [{ type: 'metafield_boolean', name: '' }],
        }),
      );
    });

    it('should have `metafield_x_array` return_type for array of references', async () => {
      const metafieldObjectMap = await typeSystem.metafieldDefinitionsObjectMap(
        'file:///any/file.liquid',
      );
      const relatedProperties = metafieldObjectMap['order_metafield_related'].properties;

      assert(relatedProperties);
      expect(relatedProperties).toHaveLength(1);

      expect(relatedProperties).toContainEqual(
        expect.objectContaining({
          name: 'prods',
          return_type: [{ type: 'metafield_product_array', name: '' }],
        }),
      );
    });
  });
});
