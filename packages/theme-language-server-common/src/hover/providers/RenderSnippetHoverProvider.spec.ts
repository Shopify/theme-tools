import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { LiquidDocDefinition } from '../../liquidDoc';

describe('Module: RenderSnippetHoverProvider', async () => {
  let provider: HoverProvider;
  let getLiquidDoc: () => Promise<LiquidDocDefinition>;
  const mockDefinitions = {
    'product-card': {
      name: 'product-card',
      parameters: [
        {
          name: 'title',
          description: 'The title of the product',
          type: 'string',
        },
        {
          name: 'border-radius',
          description: 'The border radius in px',
          type: 'number',
        },
      ],
    },
    'empty-snippet': {
      name: 'empty-snippet',
    },
  };

  const createProvider = (getLiquidDoc: () => Promise<LiquidDocDefinition>) => {
    return new HoverProvider(
      new DocumentManager(),
      {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      async (_rootUri: string) => ({} as MetafieldDefinitionMap),
      async () => ({}),
      async () => [],
      getLiquidDoc,
    );
  };

  beforeEach(async () => {
    getLiquidDoc = async () => mockDefinitions['product-card'];
    provider = createProvider(getLiquidDoc);
  });

  describe('hover', () => {
    it('should return snippet documentation with all parameters', async () => {
      await expect(provider).to.hover(
        `{% render 'product-car█d' %}`,
        '### product-card\n\n**Parameters:**\n- `title`: string - The title of the product\n- `border-radius`: number - The border radius in px',
      );
    });

    it('should return an H3 with snippet name if no LiquidDocDefinition found', async () => {
      getLiquidDoc = async () => undefined as any;
      provider = createProvider(getLiquidDoc);
      await expect(provider).to.hover(`{% render 'unknown-sni█ppet' %}`, '### unknown-snippet');
    });

    it('should return nothing if not in render tag', async () => {
      await expect(provider).to.hover(`{% assign asdf = 'snip█pet' %}`, null);
      await expect(provider).to.hover(`{{ 'snip█pet' }}`, null);
    });
  });
});
