import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { GetDocDefinitionForURI, DocDefinition } from '@shopify/theme-check-common';

const uri = 'file:///snippets/product-card.liquid';

describe('Module: RenderSnippetParameterHoverProvider', async () => {
  let provider: HoverProvider;
  let getSnippetDefinition: GetDocDefinitionForURI;
  const mockSnippetDefinition: DocDefinition = {
    uri,
    liquidDoc: {
      parameters: [
        {
          name: 'title',
          description: 'The title of the product',
          type: 'string',
          required: true,
          nodeType: 'param',
        },
      ],
    },
  };

  describe('hover', () => {
    beforeEach(() => {
      provider = createProvider(async () => mockSnippetDefinition);
    });

    it('should return null if doc definition not found', async () => {
      getSnippetDefinition = async () => undefined;
      provider = createProvider(getSnippetDefinition);
      await expect(provider).to.hover(`{% render 'product-card' tit█le: 'value' %}`, null);
    });

    it('should return null if parameter not found in doc definition', async () => {
      await expect(provider).to.hover(`{% render 'product-card' unknown-para█m: 'value' %}`, null);
    });

    it('should return parameter info from doc definition', async () => {
      await expect(provider).to.hover(
        `{% render 'product-card' ti█tle: 'My Product' %}`,
        '### `title`: string\n\nThe title of the product',
      );
    });
  });

  describe('hover on inline snippet parameters', () => {
    it('should return parameter info for inline snippet', async () => {
      provider = createProvider(async () => undefined); // No file-based snippets

      const source = `
        {% snippet product_card %}
          {% doc %}
            @param {string} title - The title of the product
            @param {number} price - The price of the product
          {% enddoc %}
          <div>{{ title }}: {{ price }}</div>
        {% endsnippet %}
        
        {% render product_card, ti█tle: 'My Product', price: 99 %}
      `;

      await expect(provider).to.hover(source, '### `title`: string\n\nThe title of the product');
    });

    it('should return null if parameter not found in inline snippet doc', async () => {
      provider = createProvider(async () => undefined);

      const source = `
        {% snippet product_card %}
          {% doc %}
            @param {string} title - The title of the product
          {% enddoc %}
          <div>{{ title }}</div>
        {% endsnippet %}
        
        {% render product_card, unknown_para█m: 'value' %}
      `;

      await expect(provider).to.hover(source, null);
    });

    it('should handle multiple inline snippets correctly', async () => {
      provider = createProvider(async () => undefined);

      const source = `
        {% snippet first_snippet %}
          {% doc %}
            @param {string} first_param - First parameter
          {% enddoc %}
          <div>{{ first_param }}</div>
        {% endsnippet %}
        
        {% snippet second_snippet %}
          {% doc %}
            @param {number} second_param - Second parameter
          {% enddoc %}
          <div>{{ second_param }}</div>
        {% endsnippet %}
        
        {% render second_snippet, second_para█m: 42 %}
      `;

      await expect(provider).to.hover(source, '### `second_param`: number\n\nSecond parameter');
    });
  });
});

const createProvider = (getSnippetDefinition: GetDocDefinitionForURI) => {
  return new HoverProvider(
    new DocumentManager(),
    {
      filters: async () => [],
      objects: async () => [],
      liquidDrops: async () => [],
      tags: async () => [],
      systemTranslations: async () => ({}),
    },
    async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    async () => ({}),
    async () => [],
    getSnippetDefinition,
  );
};
