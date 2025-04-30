import { DocDefinition } from '@shopify/theme-check-common';
import { describe, expect, it } from 'vitest';
import { formatLiquidDocContentMarkdown, formatLiquidDocParameter } from './liquidDoc';

describe('Module: liquidDoc', async () => {
  describe('formatLiquidDocContentMarkdown', async () => {
    const name = 'product-card';

    const mockDocDefinition: DocDefinition = {
      uri: `file:///${name}.liquid`,
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

    it('should format the LiquidDoc content correctly', async () => {
      // prettier-ignore
      const expectedHoverContent = 
`### ${name}

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

      const result = formatLiquidDocContentMarkdown(name, mockDocDefinition);
      expect(result).toEqual(expectedHoverContent);
    });

    it('should only return name if LiquidDocDefinition found', async () => {
      const expectedHoverContent = `### ${name}`;

      const result = formatLiquidDocContentMarkdown(name);
      expect(result).toEqual(expectedHoverContent);
    });
  });

  describe('formatLiquidDocParameter', async () => {
    it('should format a required parameter correctly', async () => {
      expect(
        formatLiquidDocParameter({
          name: 'title',
          description: 'The title of the product',
          type: 'string',
          required: true,
          nodeType: 'param',
        }),
      ).toEqual('- `title`: string - The title of the product');
    });

    it('should format an optional parameter correctly', async () => {
      expect(
        formatLiquidDocParameter({
          name: 'title',
          description: 'The title of the product',
          type: 'string',
          required: false,
          nodeType: 'param',
        }),
      ).toEqual('- `title` (Optional): string - The title of the product');
    });

    it('should format a parameter with no type correctly', async () => {
      expect(
        formatLiquidDocParameter({
          name: 'title',
          description: 'The title of the product',
          type: null,
          required: true,
          nodeType: 'param',
        }),
      ).toEqual('- `title` - The title of the product');
    });

    it('should format a parameter with no description correctly', async () => {
      expect(
        formatLiquidDocParameter({
          name: 'title',
          description: null,
          type: null,
          required: true,
          nodeType: 'param',
        }),
      ).toEqual('- `title`');
    });

    it('should format a parameter when it is meant to be in a header', async () => {
      expect(
        formatLiquidDocParameter(
          {
            name: 'title',
            description: 'The title of the product',
            type: 'string',
            required: true,
            nodeType: 'param',
          },
          true,
        ),
      ).toEqual('### `title`: string\n\nThe title of the product');
    });
  });
});
