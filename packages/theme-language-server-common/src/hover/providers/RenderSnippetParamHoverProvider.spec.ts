import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { GetSnippetDefinitionForURI, SnippetDefinition } from '../../liquidDoc';

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
    // should return snippet parameter definition when hovered
    // in this test, we should handle
    // - all information (name, type, description)
    // - no description
    // - no type
  });
});
