import { describe, beforeEach, it, expect } from 'vitest';
import { CompletionsProvider } from '../CompletionsProvider';
import { DocumentManager } from '../../documents';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { BasicParamTypes } from '@shopify/theme-check-common';

describe('Module: LiquidDocParamTypeCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        liquidDrops: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      getMetafieldDefinitions: async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    });
  });

  it("offers type completions within liquid doc's param type tag for snippets", async () => {
    const sources = [`{% doc %} @param {█`, `{% doc %} @param  {  █`];

    for (const source of sources) {
      await expect(provider).to.complete(
        { source, relativePath: 'file://snippets/file.liquid' },
        Object.values(BasicParamTypes),
      );
    }
  });

  it('offers completions within liquid doc tag for blocks', async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} @█`, relativePath: 'file://blocks/file.liquid' },
      ['param', 'example', 'description'],
    );
  });

  it("does not offer completion if it's not within liquid doc's param type tag", async () => {
    const sources = [
      `{% doc %} @param {}█`,
      `{% doc %} @example {}█`,
      `{% doc %} @param {string} - █`,
      `@param {█`,
    ];

    for (const source of sources) {
      await expect(provider).to.complete(
        { source, relativePath: 'file://snippets/file.liquid' },
        [],
      );
    }
  });

  it("does not offer completion if it's not within a snippet or block", async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} @param {█`, relativePath: 'file://sections/file.liquid' },
      [],
    );

    await expect(provider).to.complete(
      { source: `{% doc %} @param {█`, relativePath: 'file://templates/file.liquid' },
      [],
    );

    await expect(provider).to.complete(
      { source: `{% doc %} @param {█`, relativePath: 'file://layout/file.liquid' },
      [],
    );
  });
});
