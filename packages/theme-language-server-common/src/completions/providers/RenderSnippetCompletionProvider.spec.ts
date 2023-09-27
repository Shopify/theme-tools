import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

describe('Module: RenderSnippetCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider(
      new DocumentManager(),
      {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [],
      },
      async (_) => ({}),
      async (_) => ['product-card', 'image'],
    );
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
