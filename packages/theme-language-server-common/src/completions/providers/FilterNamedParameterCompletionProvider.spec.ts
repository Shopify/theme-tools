import { describe, beforeEach, it, expect } from 'vitest';
import { InsertTextFormat, type TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { CURSOR } from '../params';

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
                name: 'weight',
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
        liquidDrops: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      getMetafieldDefinitions: async (_rootUri: string) => ({} as MetafieldDefinitionMap),
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
      contexts.map((context) =>
        expect(provider, context).to.complete(context, ['crop', 'weight', 'width']),
      ),
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

  describe('when the user has already typed out the parameter name', () => {
    describe('and the cursor is in the middle of the parameter', () => {
      it('changes the range depending on the completion item', async () => {
        //                               char 24 ⌄         ⌄ char 34
        const context = `{{ product | image_url: w█idth: 100, height: 200 | image_tag }}`;
        //                                            ⌃ char 29

        const weightTextEdit: TextEdit = {
          newText: "weight: '$1'",
          range: {
            end: { line: 0, character: 34 },
            start: { line: 0, character: 24 },
          },
        };

        const widthTextEdit: TextEdit = {
          newText: 'width',
          range: {
            end: { line: 0, character: 29 },
            start: { line: 0, character: 24 },
          },
        };

        await expect(provider).to.complete(context, [
          expect.objectContaining({
            label: 'weight',
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: expect.objectContaining(weightTextEdit),
          }),
          expect.objectContaining({
            label: 'width',
            insertTextFormat: InsertTextFormat.PlainText,
            textEdit: expect.objectContaining(widthTextEdit),
          }),
        ]);

        const textDocument = TextDocument.create('', 'liquid', 0, context.replace(CURSOR, ''));

        expect(TextDocument.applyEdits(textDocument, [weightTextEdit])).toBe(
          "{{ product | image_url: weight: '$1', height: 200 | image_tag }}",
        );

        expect(TextDocument.applyEdits(textDocument, [widthTextEdit])).toBe(
          '{{ product | image_url: width: 100, height: 200 | image_tag }}',
        );
      });
    });

    describe('and the cursor is at the beginning of the parameter', () => {
      it('offers a full list of completion items', async () => {
        const context = `{{ product | image_url: █crop: 'center' }}`;

        await expect(provider).to.complete(context, ['crop', 'weight', 'width']);
      });

      it('does not replace the existing text', async () => {
        //                               char 24 ⌄
        const context = `{{ product | image_url: █crop: 'center' }}`;

        const textEdit: TextEdit = {
          newText: 'width: ',
          range: {
            end: { line: 0, character: 24 },
            start: { line: 0, character: 24 },
          },
        };

        await expect(provider).to.complete(
          context,
          expect.arrayContaining([
            expect.objectContaining({
              label: 'width',
              insertTextFormat: InsertTextFormat.PlainText,
              textEdit,
            }),
          ]),
        );

        const textDocument = TextDocument.create('', 'liquid', 0, context.replace(CURSOR, ''));

        expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
          "{{ product | image_url: width: crop: 'center' }}",
        );
      });
    });

    describe('and the cursor is at the end of the parameter', () => {
      it('restricts the range to only the name of the parameter', async () => {
        //                               char 24 ⌄   ⌄ char 28
        const context = `{{ product | image_url: crop█: 'center' }}`;

        const textEdit: TextEdit = {
          newText: 'crop',
          range: {
            end: { line: 0, character: 28 },
            start: { line: 0, character: 24 },
          },
        };

        await expect(provider).to.complete(context, [
          expect.objectContaining({
            label: 'crop',
            insertTextFormat: InsertTextFormat.PlainText,
            textEdit,
          }),
        ]);

        const textDocument = TextDocument.create('', 'liquid', 0, context.replace(CURSOR, ''));

        expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
          "{{ product | image_url: crop: 'center' }}",
        );
      });
    });
  });

  describe('when the parameter is a string type', () => {
    it('includes quotes in the insertText', async () => {
      const context = `{{ product | image_url: cr█`;

      await expect(provider).to.complete(context, [
        expect.objectContaining({
          label: 'crop',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: expect.objectContaining({
            newText: "crop: '$1'",
          }),
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
          insertTextFormat: InsertTextFormat.PlainText,
          textEdit: expect.objectContaining({
            newText: 'width: ',
          }),
        }),
      ]);
    });
  });

  describe('when the cursor is inside of a quotes', () => {
    it('does not return any completion options', async () => {
      const context = `{{ product | image_url: width: 100, crop: '█'`;

      await expect(provider).to.complete(context, []);
    });
  });
});
