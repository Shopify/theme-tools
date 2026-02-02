import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

describe('Module: HtmlAttributeValueCompletionProvider', async () => {
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
      getMetafieldDefinitions: async (_rootUri: string) => ({}) as MetafieldDefinitionMap,
    });
  });

  it('should complete known void element attribute values', async () => {
    const expected = ['lazy', 'eager'].sort();
    await expect(provider).to.complete('<img loading="█"', expected);
  });

  it('should complete known tag attribute values', async () => {
    const expected = ['get', 'post', 'dialog'].sort();
    await expect(provider).to.complete('<form method="█"', expected);
  });

  it('should filter results', async () => {
    const expected = ['get'].sort();
    await expect(provider).to.complete('<form method="g█"', expected);
  });
});
