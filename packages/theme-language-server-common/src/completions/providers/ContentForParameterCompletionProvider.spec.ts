import { describe, afterEach, beforeEach, it, expect, vi } from 'vitest';
import { CompletionsProvider } from '../CompletionsProvider';
import { DocumentManager } from '../../documents';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { TextEdit, InsertTextFormat } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CURSOR } from '../params';

vi.mock('./data/contentForParameterCompletionOptions', async () => {
  const actual = (await vi.importActual(
    './data/contentForParameterCompletionOptions',
  )) as typeof import('./data/contentForParameterCompletionOptions');
  return {
    DEFAULT_COMPLETION_OPTIONS: {
      ...actual.DEFAULT_COMPLETION_OPTIONS,
      // Add another option here so we can properly test some scenarios that
      // we wouldn't be able to otherwise.
      testOption: '',
    },
  };
});

describe('Module: ContentForBlockParameterCompletionProvider', async () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers a full list of completion items', async () => {
    await expect(provider).to.complete('{% content_for "block", █ %}', [
      'type',
      'id',
      'closest',
      'testOption',
    ]);
  });

  it('does not offer completion items if they are already present', async () => {
    const context = `{% content_for "block", type: "fake-block", id: "fake-id", █ %}`;

    await expect(provider).to.complete(context, ['closest', 'testOption']);
  });

  it('uses text edits to insert the completion item', async () => {
    //                               char 24 ⌄
    const context = `{% content_for "block", █ %}`;

    const textEdit: TextEdit = {
      newText: "type: '$1'",
      range: {
        end: { line: 0, character: 24 },
        start: { line: 0, character: 24 },
      },
    };

    await expect(provider).to.complete(
      context,
      expect.arrayContaining([
        expect.objectContaining({
          label: 'type',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit,
        }),
      ]),
    );

    const textDocument = TextDocument.create('', 'liquid', 0, context.replace(CURSOR, ''));

    expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
      `{% content_for "block", type: '$1' %}`,
    );
  });

  it('provides a different style of completion for "closest"', async () => {
    //                               char 24 ⌄
    const context = `{% content_for "block", █ %}`;

    const textEdit: TextEdit = {
      newText: 'closest.',
      range: {
        end: { line: 0, character: 24 },
        start: { line: 0, character: 24 },
      },
    };

    await expect(provider).to.complete(
      context,
      expect.arrayContaining([
        expect.objectContaining({
          label: 'closest',
          insertTextFormat: InsertTextFormat.PlainText,
          textEdit,
        }),
      ]),
    );

    const textDocument = TextDocument.create('', 'liquid', 0, context.replace(CURSOR, ''));

    expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
      `{% content_for "block", closest. %}`,
    );
  });

  describe("when we're completing for blocks we allow `closest`", () => {
    it('does something', async () => {
      await expect(provider).to.complete('{% content_for "blocks", █ %}', ['closest']);
    });
  });

  describe('when the user has already started typing the name of the parameter', () => {
    it('filters the completion options to only include ones that match', async () => {
      await expect(provider).to.complete('{% content_for "block", t█ %}', ['type', 'testOption']);
    });
  });

  describe('when the user has already typed out a parameter name', () => {
    describe('and the cursor is in the middle of the parameter', () => {
      it('changes the range depending on the completion item', async () => {
        //                              char 24 ⌄               ⌄ char 38
        const context = `{% content_for "block", t█ype: "button" %}`;
        //                                            ⌃ char 28

        const typeTextEdit: TextEdit = {
          newText: 'type',
          range: {
            end: { line: 0, character: 28 },
            start: { line: 0, character: 24 },
          },
        };

        const testTextEdit: TextEdit = {
          newText: "testOption: '$1'",
          range: {
            end: { line: 0, character: 38 },
            start: { line: 0, character: 24 },
          },
        };

        await expect(provider).to.complete(context, [
          expect.objectContaining({
            label: 'type',
            insertTextFormat: InsertTextFormat.PlainText,
            textEdit: expect.objectContaining(typeTextEdit),
          }),
          expect.objectContaining({
            label: 'testOption',
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: expect.objectContaining(testTextEdit),
          }),
        ]);

        const textDocument = TextDocument.create('', 'liquid', 0, context.replace(CURSOR, ''));

        expect(TextDocument.applyEdits(textDocument, [testTextEdit])).toBe(
          `{% content_for "block", testOption: '$1' %}`,
        );

        expect(TextDocument.applyEdits(textDocument, [typeTextEdit])).toBe(
          `{% content_for "block", type: "button" %}`,
        );
      });
    });

    describe('and the cursor is at the beginning of the parameter', () => {
      it('offers a full list of completion items', async () => {
        const context = `{% content_for "block", █type: "button" %}`;

        await expect(provider).to.complete(context, ['type', 'id', 'closest', 'testOption']);
      });

      it('does not replace the existing text', async () => {
        //                               char 24 ⌄
        const context = `{% content_for "block", █type: "button" %}`;

        const textEdit: TextEdit = {
          newText: "testOption: '$1', ",
          range: {
            end: { line: 0, character: 24 },
            start: { line: 0, character: 24 },
          },
        };

        await expect(provider).to.complete(
          context,
          expect.arrayContaining([
            expect.objectContaining({
              label: 'testOption',
              insertTextFormat: InsertTextFormat.Snippet,
              textEdit,
            }),
          ]),
        );

        const textDocument = TextDocument.create('', 'liquid', 0, context.replace(CURSOR, ''));

        expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
          `{% content_for "block", testOption: '$1', type: "button" %}`,
        );
      });
    });

    describe('and the cursor is at the end of the parameter', () => {
      it('offers only the same completion item', async () => {
        const context = `{% content_for "block", type█: "button" %}`;

        await expect(provider).to.complete(context, ['type']);
      });

      it('only replaces the parameter name', async () => {
        //                              char 24 ⌄     ⌄ char 28
        const context = `{% content_for "block", type█: "button" %}`;

        const textEdit: TextEdit = {
          newText: 'type',
          range: {
            end: { line: 0, character: 28 },
            start: { line: 0, character: 24 },
          },
        };

        await expect(provider).to.complete(
          context,
          expect.arrayContaining([
            expect.objectContaining({
              label: 'type',
              insertTextFormat: InsertTextFormat.PlainText,
              textEdit,
            }),
          ]),
        );

        const textDocument = TextDocument.create('', 'liquid', 0, context.replace(CURSOR, ''));

        expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
          `{% content_for "block", type: "button" %}`,
        );
      });
    });
  });

  describe('when the referred block has LiquidDoc parameters', () => {
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
        getDocDefinitionForURI: async (_uri, _category, _name) => {
          return {
            uri: 'file:///blocks/product-card.liquid',
            liquidDoc: {
              parameters: [
                {
                  nodeType: 'param',
                  name: 'example-string-param',
                  type: 'string',
                  description: 'An example string parameter',
                  required: true,
                },
                {
                  nodeType: 'param',
                  name: 'example-number-param',
                  type: 'number',
                  description: 'An example number parameter',
                  required: true,
                },
                {
                  nodeType: 'param',
                  name: 'example-boolean-param',
                  type: 'boolean',
                  description: 'An example boolean parameter',
                  required: true,
                },
                {
                  nodeType: 'param',
                  name: 'example-object-param',
                  type: 'object',
                  description: 'An example object parameter',
                  required: true,
                },
                {
                  nodeType: 'param',
                  name: 'example-unknown-param',
                  type: 'unknown',
                  description: 'An example unknown parameter',
                  required: true,
                },
              ],
            },
          };
        },
      });
    });

    it('offers the LiquidDoc parameters as completions', async () => {
      const context = `{% content_for "block", type: 'fake-block', █ %}`;

      await expect(provider).to.complete(
        context,
        expect.arrayContaining([
          expect.objectContaining({
            label: 'example-string-param',
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: expect.objectContaining({
              newText: "example-string-param: '$1'$0",
            }),
          }),
          expect.objectContaining({
            label: 'example-number-param',
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: expect.objectContaining({
              newText: 'example-number-param: ${1:0}$0',
            }),
          }),
          expect.objectContaining({
            label: 'example-boolean-param',
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: expect.objectContaining({
              newText: 'example-boolean-param: ${1:false}$0',
            }),
          }),
          expect.objectContaining({
            label: 'example-object-param',
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: expect.objectContaining({
              newText: 'example-object-param: ${1:}$0',
            }),
          }),
          expect.objectContaining({
            label: 'example-unknown-param',
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: expect.objectContaining({
              newText: 'example-unknown-param: ${1:}$0',
            }),
          }),
        ]),
      );
    });
  });
});
