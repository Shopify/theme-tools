import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { GetSnippetDefinitionForURI, SnippetDefinition } from '../../liquidDoc';
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
        },
        {
          name: 'border-radius',
          description: 'The border radius in px',
          type: 'number',
        },
        {
          name: 'no-type',
          description: 'This parameter has no type',
          type: null,
        },
        {
          name: 'no-description',
          description: null,
          type: 'string',
        },
        {
          name: 'no-type-or-description',
          description: null,
          type: null,
        },
      ],
    },
  };

  const createProvider = (getSnippetDefinition: GetSnippetDefinitionForURI) => {
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
      getSnippetDefinition,
    );
  };

  beforeEach(async () => {
    getSnippetDefinition = async () => mockSnippetDefinition;
    provider = createProvider(getSnippetDefinition);
  });

  describe('hover', () => {
    it('should return snippet definition with all parameters', async () => {
      await expect(provider).to.hover(
        `{% render 'product-car█d' %}`,
        '### product-card\n\n**Parameters:**\n- `title`: string - The title of the product\n- `border-radius`: number - The border radius in px\n- `no-type` - This parameter has no type\n- `no-description`: string\n- `no-type-or-description`',
      );
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
  });
});
