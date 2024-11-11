import { describe, beforeEach, it, expect } from 'vitest';
import { CompletionsProvider } from '../CompletionsProvider';
import { DocumentManager } from '../../documents';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

describe('Module: ContentForCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      getMetafieldDefinitions: async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    });
  });

  it('should complete content_for block keywords correctly', async () => {
    const expected = ['block', 'blocks'].sort();
    await expect(provider).to.complete('{% content_for "█" %}', expected);
  });
});
