import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { beforeEach, describe, expect, it } from 'vitest';
import { InsertTextFormat } from 'vscode-json-languageservice';
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
      getThemeBlockNames: async (_rootUri: string, _includePrivate: boolean) => [
        'block-1',
        'block-2',
      ],
    });
  });

  it('should complete content_for "block" type parameter ', async () => {
    const expected = ['block-1', 'block-2'].sort();
    await expect(provider).to.complete('{% content_for "block", type: "█" %}', expected);
  });

  it('should not complete content_for "blocks" type parameter', async () => {
    await expect(provider).to.complete('{% content_for "blocks", type: "█" %}', []);
  });

  it('should not complete content_for "block" id parameter', async () => {
    await expect(provider).to.complete('{% content_for "block", type: "", id: "█" %}', []);
  });
});
