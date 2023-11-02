import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

describe('Module: TranslationCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [],
      },
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
    await expect(provider).to.complete('{{ "general.comments', [
      expect.objectContaining({
        documentation: {
          kind: 'markdown',
          value: expect.stringMatching(/one(.|\n)*comment(.|\n)*other(.|\n)*comments/m),
        },
      }),
    ]);
    await expect(provider).to.complete('{{ "general.passwo█" }}', [
      expect.objectContaining({
        label: '"general.password" | t',
        insertText: 'password',
        textEdit: expect.objectContaining({
          newText: 'general.password" | t',
        }),
      }),
    ]);
  });
});
