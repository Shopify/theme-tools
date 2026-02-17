import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { GetDocDefinitionForURI, DocDefinition } from '@shopify/theme-check-common';

const uri = 'file:///blocks/product-card.liquid';

describe('Module: ContentForArgumentHoverProvider', async () => {
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
      await expect(provider).to.hover(
        `{% content_for 'block', type: 'product-card', tit█le: 'value' %}`,
        null,
      );
    });

    it('should return null if parameter not found in doc definition', async () => {
      await expect(provider).to.hover(
        `{% content_for 'block', type: unknown-para█m: 'value' %}`,
        null,
      );
    });

    it('should return parameter info from doc definition', async () => {
      await expect(provider).to.hover(
        `{% content_for 'block', type: 'product-card', ti█tle: 'My Product' %}`,
        '### `title`: string\n\nThe title of the product',
      );
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
    async (_rootUri: string) => ({}) as MetafieldDefinitionMap,
    async () => ({}),
    async () => [],
    getSnippetDefinition,
  );
};
