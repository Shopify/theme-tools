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
    await expect(provider).to.complete(`{% doc %} @█`, ['param', 'example', 'description']);
    await expect(provider).to.complete(`{% doc %} @par█`, ['param']);
  });

  it("does not offer completion if it doesn't start with @", async () => {
    await expect(provider).to.complete(`{% doc %} █`, []);
  });

  it('does not offer completion if it is not within a doc tag', async () => {
    await expect(provider).to.complete(`{% notdoc %} @█`, []);
  });
});
