import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

describe('Module: TranslationCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider(
      new DocumentManager(),
      {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [],
      },
      async (_) => ({
        general: {
          username_html: '<b>username</b>',
          password: 'password',
          comments: {
            one: '{{ count }} comment',
            other: '{{ count }} comments',
          },
        },
      }),
    );
  });

  it('should complete translations correctly', async () => {
    await expect(provider).to.complete('{{ "genera', [
      'general.username_html',
      'general.password',
      'general.comments',
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
        label: 'general.password',
        insertText: 'password',
        textEdit: expect.objectContaining({
          newText: 'general.password" | t',
        }),
      }),
    ]);
  });
});
