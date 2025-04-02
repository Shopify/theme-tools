import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { GetSnippetDefinitionForURI, SnippetDefinition } from '@shopify/theme-check-common';
import '../../../../theme-check-common/src/test/test-setup';

describe('Module: RenderSnippetHoverProvider', async () => {
  let provider: HoverProvider;
  let getSnippetDefinition: GetSnippetDefinitionForURI;
  const mockSnippetDefinition: SnippetDefinition = {
    name: 'product-card',
    liquidDoc: {
      parameters: [
        {
          name: 'title',
          description: 'The title of the product',
          type: 'string',
          required: true,
          nodeType: 'param',
        },
        {
          name: 'border-radius',
          description: 'The border radius in px',
          type: 'number',
          required: false,
          nodeType: 'param',
        },
        {
          name: 'no-type',
          description: 'This parameter has no type',
          type: null,
          required: true,
          nodeType: 'param',
        },
        {
          name: 'no-description',
          description: null,
          type: 'string',
          required: true,
          nodeType: 'param',
        },
        {
          name: 'no-type-or-description',
          description: null,
          type: null,
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
        {
          content: '{{ product.title }}',
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
- \`border-radius\` (Optional): number - The border radius in px
- \`no-type\` - This parameter has no type
- \`no-description\`: string
- \`no-type-or-description\`

**Examples:**
\`\`\`liquid
{{ product }}
\`\`\`
\`\`\`liquid
{{ product.title }}
\`\`\``;

      await expect(provider).to.hover(`{% render 'product-car█d' %}`, expectedHoverContent);
    });

    it('should return null if no LiquidDocDefinition found', async () => {
      getSnippetDefinition = async () => ({ name: 'unknown-snippet', liquidDoc: undefined });
      provider = createProvider(getSnippetDefinition);
      await expect(provider).to.hover(`{% render 'unknown-sni█ppet' %}`, `### unknown-snippet`);
    });

    it('should return null if snippet is null', async () => {
      getSnippetDefinition = async () => undefined;
      provider = createProvider(getSnippetDefinition);
      await expect(provider).to.hover(`{% render 'unknown-sni█ppet' %}`, null);
    });

    it('should return nothing if not in render tag', async () => {
      await expect(provider).to.hover(`{% assign asdf = 'snip█pet' %}`, null);
      await expect(provider).to.hover(`{{ 'snip█pet' }}`, null);
    });

    it('should wrap optional parameters in (Optional)', async () => {
      provider = createProvider(async () => ({
        name: 'product-card',
        liquidDoc: {
          parameters: [
            {
              name: 'title',
              description: 'The title of the product',
              type: 'string',
              required: true,
              nodeType: 'param',
            },
            {
              name: 'border-radius',
              description: 'The border radius in px',
              type: 'number',
              required: false,
              nodeType: 'param',
            },
          ],
        },
      }));
      await expect(provider).to.hover(
        `{% render 'product-car█d' %}`,
        '### product-card\n\n**Parameters:**\n- `title`: string - The title of the product\n- `border-radius` (Optional): number - The border radius in px',
      );
    });
  });
});

const createProvider = (getSnippetDefinition: GetSnippetDefinitionForURI) => {
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
