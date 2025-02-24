import { describe, beforeEach, it, expect } from 'vitest';
import { CompletionsProvider } from '../CompletionsProvider';
import { DocumentManager } from '../../documents';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

describe('Module: LiquidDocTagCompletionProvider', async () => {
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

  it('offers completions within liquid doc tag', async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} @█`, relativePath: 'file://snippets/file.liquid' },
      ['param', 'example', 'description'],
    );
    await expect(provider).to.complete(
      { source: `{% doc %} @par█`, relativePath: 'file://snippets/file.liquid' },
      ['param'],
    );
  });

  it("does not offer completion if it doesn't start with @", async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} █`, relativePath: 'file://snippets/file.liquid' },
      [],
    );
  });

  it('does not offer completion if it is not within a doc tag', async () => {
    await expect(provider).to.complete(
      { source: `{% notdoc %} @█`, relativePath: 'file://snippets/file.liquid' },
      [],
    );
  });

  it('does not offer completion if it is not a snippet file', async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} @█`, relativePath: 'file://sections/file.liquid' },
      [],
    );
  });
});
