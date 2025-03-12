import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

describe('Module: ContentForBlockTypeCompletionProvider', async () => {
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

  it('should complete content_for "block" type parameter ', async () => {
    const expected = ['block-1', 'block-2'].sort();
    await expect(provider).to.complete(
      `{% stylesheet %}
        .block-1 { display: fl█ }
      {% endstylesheet %}`,
      expected,
    );
  });
});
