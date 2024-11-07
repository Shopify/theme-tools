import { expect, describe, it, beforeEach } from 'vitest';
import { CompletionsProvider } from '../completions';
import { DocumentManager } from '../documents';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

describe('Module: CompletionItemsAssertion', () => {
  let provider: CompletionsProvider;
  let documentManager: DocumentManager;

  beforeEach(async () => {
    documentManager = new DocumentManager();
    provider = new CompletionsProvider({
      documentManager,
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [{ name: 'render' }],
        systemTranslations: async () => ({}),
      },
      getMetafieldDefinitions: async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    });
  });

  it('should assert a list of labels', async () => {
    await expect(provider).to.complete('{% rend', ['render']);
  });

  it('should assert a list of completion items', async () => {
    await expect(provider).to.complete('{% rend', [
      expect.objectContaining({
        label: 'render',
        sortText: 'render',
        documentation: {
          kind: 'markdown',
          value: '### render',
        },
        insertTextFormat: 2,
        kind: 14,
      }),
    ]);
  });

  it('should assert an empty list', async () => {
    await expect(provider).to.complete('{% something', []);
  });
});
