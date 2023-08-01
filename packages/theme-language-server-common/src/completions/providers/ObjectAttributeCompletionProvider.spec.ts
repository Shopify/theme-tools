import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

describe('Module: ObjectAttributeCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider(new DocumentManager(), {
      filters: async () => [],
      objects: async () => [
        { name: 'global', properties: [{ name: 'prop1' }, { name: 'prop2' }] },
        { name: 'all_products' },
      ],
      tags: async () => [],
    });
  });

  it('returns the properties of global variables', async () => {
    await expect(provider).to.complete('{{ global.p█ }}', ['prop1', 'prop2']);
  });
});
