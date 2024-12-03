import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { beforeEach, describe, expect, it } from 'vitest';
import { InsertTextFormat } from 'vscode-json-languageservice';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

describe('Module: ContentForCompletionProvider', async () => {
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

  it('should complete content_for block keywords correctly', async () => {
    const expected = ['block', 'blocks'].sort();
    await expect(provider).to.complete('{% content_for "█" %}', expected);
  });

  describe('when the text being completed does not have extra markup', () => {
    it('should text edit complete content_for block with type & id placeholders', async () => {
      const source = '{% content_for "█" %}';
      await expect(provider).to.complete(
        source,
        expect.arrayContaining([
          expect.objectContaining({
            label: 'block',
            textEdit: expect.applyTextEdit(
              source,
              `{% content_for "block", type: "$1", id: "$2" %}`,
            ),
          }),
        ]),
      );
    });

    it('should keep using the quote type used', async () => {
      const source = `{% content_for '█' %}`;
      await expect(provider).to.complete(
        source,
        expect.arrayContaining([
          expect.objectContaining({
            label: 'block',
            textEdit: expect.applyTextEdit(
              source,
              // single quotes everywhere
              `{% content_for 'block', type: '$1', id: '$2' %}`,
            ),
          }),
        ]),
      );
    });

    it('should text edit complete inside the liquid liquid tag', async () => {
      const source = `{% liquid
        content_for "█"
        echo "more content"
      %}`;
      const afterEdit = `{% liquid
        content_for "block", type: "$1", id: "$2"
        echo "more content"
      %}`;
      await expect(provider).to.complete(
        source,
        expect.arrayContaining([
          expect.objectContaining({
            label: 'block',
            textEdit: expect.applyTextEdit(source, afterEdit),
          }),
        ]),
      );
    });
  });

  describe('when it has extra markup', () => {
    it('should not text edit complete', async () => {
      const source = '{% content_for "█", type: "some-type", id: "some-id" %}';
      await expect(provider).to.complete(
        source,
        expect.arrayContaining([
          expect.objectContaining({
            label: 'block',
            insertTextFormat: InsertTextFormat.PlainText,
          }),
        ]),
      );
    });
  });
});
