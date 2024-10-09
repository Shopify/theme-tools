import { describe, beforeEach, it, expect } from 'vitest';
import { InsertTextFormat } from 'vscode-languageserver';

import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

describe('Module: ObjectCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [
          {
            parameters: [
              {
                description: '',
                name: 'crop',
                positional: false,
                required: false,
                types: ['string'],
              },
              {
                description: '',
                name: 'width',
                positional: false,
                required: false,
                types: ['number'],
              },
            ],
            name: 'image_url',
          },
        ],
        objects: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
    });
  });

  it('should complete filter parameter lookups', async () => {
    const contexts = [
      `{{ product | image_url: █`,
      `{{ product | image_url: width: 100, █`,
      `{{ product | image_url: 1, string, width: 100, █`,
      `{{ product | image_url: width: 100 | image_url: █`,
    ];
    await Promise.all(
      contexts.map((context) => expect(provider, context).to.complete(context, ['crop', 'width'])),
    );
  });

  describe('when the user has already begun typing a filter parameter', () => {
    it('should filter options based on the text', async () => {
      const contexts = [
        `{{ product | image_url: c█`,
        `{{ product | image_url: width: 100, c█`,
        `{{ product | image_url: 1, string, width: 100, c█`,
        `{{ product | image_url: width: 100 | image_url: c█`,
      ];
      await Promise.all(
        contexts.map((context) => expect(provider, context).to.complete(context, ['crop'])),
      );
    });
  });

  describe('when the parameter is a string type', () => {
    it('includes quotes in the insertText', async () => {
      const context = `{{ product | image_url: cr█`;

      await expect(provider).to.complete(context, [
        expect.objectContaining({
          label: 'crop',
          insertText: "crop: '$1'",
          insertTextFormat: InsertTextFormat.Snippet,
        }),
      ]);
    });
  });

  describe('when the parameter is not a string type', () => {
    it('does not include a tab stop position', async () => {
      const context = `{{ product | image_url: wid█`;

      await expect(provider).to.complete(context, [
        expect.objectContaining({
          label: 'width',
          insertText: 'width: ',
          insertTextFormat: InsertTextFormat.PlainText,
        }),
      ]);
    });
  });
});
