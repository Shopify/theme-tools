import { expect, describe, it, beforeEach } from 'vitest';
import { CompletionsProvider } from '../completions';
import { DocumentManager } from '../documents';

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
      },
    });
  });

  it('should assert a list of labels', () => {
    expect(provider).to.complete('{% rend', ['render']);
  });

  it('should assert a list of completion items', () => {
    expect(provider).to.complete('{% rend', [
      {
        label: 'render',
        sortText: 'render',
        documentation: {
          kind: 'markdown',
          value: '### render',
        },
        kind: 14,
      },
    ]);
  });

  it('should assert an empty list', () => {
    expect(provider).to.complete('{% something', []);
  });
});
