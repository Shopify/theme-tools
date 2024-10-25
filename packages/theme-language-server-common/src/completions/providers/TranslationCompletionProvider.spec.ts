import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

describe('Module: TranslationCompletionProvider', async () => {
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
      getTranslationsForURI: async (_) => ({
        general: {
          username_html: '<b>username</b>',
          password: 'password',
          comments: {
            one: '{{ count }} comment',
            other: '{{ count }} comments',
          },
        },
      }),
    });
  });

  it('should complete translations correctly', async () => {
    await expect(provider).to.complete('{{ "genera', [
      '"general.username_html" | t',
      '"general.password" | t',
      '"general.comments" | t',
    ]);

    // Why all three you ask? Because we want to support fuzzy matching.
    // We leave filtering up to the client.
    await expect(provider).to.complete('{{ "general.comments', [
      '"general.username_html" | t',
      '"general.password" | t',
      expect.objectContaining({
        documentation: {
          kind: 'markdown',
          value: expect.stringMatching(/one(.|\n)*comment(.|\n)*other(.|\n)*comments/m),
        },
      }),
    ]);
    await expect(provider).to.complete('{{ "general.passwo█" }}', [
      '"general.username_html" | t',
      expect.objectContaining({
        label: '"general.password" | t',
        insertText: 'password',
        textEdit: expect.objectContaining({
          newText: 'general.password" | t',
        }),
      }),
      '"general.comments" | t',
    ]);
  });
});
