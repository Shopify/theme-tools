import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

describe('Module: RenderSnippetCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        liquidDrops: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      getTranslationsForURI: async (_) => ({}),
      getSnippetNamesForURI: async (_) => ['product-card', 'image'],
      getMetafieldDefinitions: async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    });
  });

  it('should complete snippets correctly', async () => {
    await expect(provider).to.complete('{% render "', ['product-card', 'image']);
    await expect(provider).to.complete('{% render "product', [
      expect.objectContaining({
        documentation: {
          kind: 'markdown',
          value: 'snippets/product-card.liquid',
        },
      }),
    ]);
  });
});
