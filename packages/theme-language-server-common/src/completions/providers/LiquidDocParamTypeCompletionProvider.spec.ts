import { describe, beforeEach, it, expect } from 'vitest';
import { CompletionsProvider } from '../CompletionsProvider';
import { DocumentManager } from '../../documents';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { SupportedParamTypes } from '@shopify/theme-check-common';

describe('Module: LiquidDocParamTypeCompletionProvider', async () => {
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

  it("offers type completions within liquid doc's param type tag", async () => {
    const sources = [`{% doc %} @param {█`, `{% doc %} @param  {  █`];

    for (const source of sources) {
      await expect(provider).to.complete(source, Object.values(SupportedParamTypes));
    }
  });

  it("does not offer completion if it's not within liquid doc's param type tag", async () => {
    const sources = [
      `{% doc %} @param {}█`,
      `{% doc %} @example {}█`,
      `{% doc %} @param {string} - █`,
      `@param {█`,
    ];

    for (const source of sources) {
      await expect(provider).to.complete(source, []);
    }
  });
});
