import { describe, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { GetDocDefinitionForURI, DocDefinition } from '@shopify/theme-check-common';

const uri = 'file:///snippets/product-card.liquid';

describe('Module: RenderSnippetHoverProvider', async () => {
  let provider: HoverProvider;
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
      description: {
        content: 'This is a description',
        nodeType: 'description',
      },
      examples: [
        {
          content: '{{ product }}',
          nodeType: 'example',
        },
      ],
    },
  };

  describe('hover', () => {
    it('should return snippet definition with all parameters', async () => {
      provider = createProvider(async () => mockSnippetDefinition);
      // prettier-ignore
      const expectedHoverContent = 
`### product-card

**Description:**


This is a description

**Parameters:**
- \`title\`: string - The title of the product

**Examples:**
\`\`\`liquid
{{ product }}
\`\`\``;

      await expect(provider).to.hover(`{% render 'product-car█d' %}`, expectedHoverContent);
    });

    it('should return nothing if not in render tag', async () => {
      await expect(provider).to.hover(`{% assign asdf = 'snip█pet' %}`, null);
      await expect(provider).to.hover(`{{ 'snip█pet' }}`, null);
    });

    it('should return snippet definition with all parameters for inline snippet', async () => {
      provider = createProvider(async () => undefined); // No file-based snippets

      const source = `
        {% snippet inline_product_card %}
          {% doc %}
            @param {string} title - The title of the inline product card

            @example
            {% render inline_product_card, title: 'My Product' %}
          {% enddoc %}
          <div>{{ title }}</div>
        {% endsnippet %}
        
        {% render inline_produc█t_card %}
      `;

      // prettier-ignore
      const expectedHoverContent = 
`### inline_product_card

**Parameters:**
- \`title\`: string - The title of the inline product card

**Examples:**
\`\`\`liquid
{% render inline_product_card, title: 'My Product' %}
\`\`\``;

      await expect(provider).to.hover(source, expectedHoverContent);
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
