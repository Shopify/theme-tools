import { FilterEntry, MetafieldDefinitionMap, ObjectEntry } from '@shopify/theme-check-common';
import { InsertTextFormat, type TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { CURSOR } from '../params';

const filters: FilterEntry[] = [
  {
    name: 'upcase',
    syntax: 'string | upcase',
    return_type: [{ type: 'string', name: '' }],
  },
  {
    name: 'downcase',
    syntax: 'string | downcase',
    return_type: [{ type: 'string', name: '' }],
  },
  {
    name: 'split',
    syntax: 'string | split: string',
    return_type: [{ type: 'array', array_value: 'string' }],
  },
  {
    name: 'first',
    syntax: 'array | first',
    return_type: [{ type: 'untyped', name: '' }],
  },
  {
    name: 'map',
    syntax: 'array | map: string',
    return_type: [{ type: 'array', array_value: 'string' }],
  },
  {
    name: 'where',
    syntax: 'array | where: string, string',
    return_type: [{ type: 'array', array_value: 'string' }],
  },
  {
    name: 'metafield_tag',
    syntax: 'metafield | metafield_tag',
    return_type: [{ type: 'string', name: '' }],
  },
  {
    name: 'default',
    syntax: 'variable | default: variable',
    return_type: [{ type: 'untyped', name: '' }],
    parameters: [
      {
        description: 'Whether to use false values instead of the default.',
        name: 'allow_false',
        positional: true,
        required: false,
        types: ['boolean'],
      },
    ],
  },
  {
    syntax: 'string | highlight: string',
    name: 'highlight',
    parameters: [
      {
        description: 'The string that you want to highlight.',
        name: 'highlighted_term',
        positional: true,
        required: true,
        types: ['string'],
      },
    ],
  },
  {
    syntax: 'string | preload_tag: as: string',
    name: 'preload_tag',
    parameters: [
      {
        description: 'The type of element or resource to preload.',
        name: 'as',
        positional: false,
        required: true,
        types: ['string'],
      },
    ],
  },
  {
    name: 'missing_syntax',
    /* syntax: undefined */
  },
];

const objects: ObjectEntry[] = [
  {
    name: 'string',
    return_type: [{ type: 'string', name: '' }],
  },
  {
    name: 'number',
    return_type: [{ type: 'number', name: '' }],
  },
  {
    name: 'array',
    return_type: [{ type: 'array', array_value: 'string' }],
  },
  {
    name: 'metafield',
    return_type: [],
  },
  {
    name: 'product',
    return_type: [],
  },
];

const anyFilters = filtersNamesOfInputType('variable').concat(
  filters.filter((entry) => !entry.syntax).map((x) => x.name),
);
const stringFilters = filtersNamesOfInputType('string');
const metafieldFilters = filtersNamesOfInputType('metafield');
const arrayFilters = filtersNamesOfInputType('array');
const allFilters = filters.map((x) => x.name).sort();

describe('Module: FilterCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => filters,
        objects: async () => objects,
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      getMetafieldDefinitions: async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    });
  });

  it('completes with all the filters when no specific filters exist for that type', async () => {
    await expect(provider).to.complete('{{ product | █ }}', allFilters);
  });

  it('completes with all the filters when the type is unknown', async () => {
    await expect(provider).to.complete('{{ undefined | █ }}', allFilters);
  });

  it('should complete string types with string filters', async () => {
    await expect(provider).to.complete('{{ string | █ }}', stringFilters.concat(anyFilters));
  });

  it('should complete array types with array filters', async () => {
    await expect(provider).to.complete('{{ array | █ }}', arrayFilters.concat(anyFilters));
  });

  it('should complete named types with named-type filters', async () => {
    await expect(provider).to.complete('{{ metafield | █ }}', metafieldFilters.concat(anyFilters));
  });

  it('should infer type in filter chains', async () => {
    await expect(provider).to.complete(
      '{{ metafield | metafield_tag | █ }}',
      stringFilters.concat(anyFilters),
    );
    await expect(provider).to.complete(
      '{{ string | split: "" | █ }}',
      arrayFilters.concat(anyFilters),
    );
    await expect(provider).to.complete('{{ array | first | █ }}', allFilters);
  });

  it('should append the any filters after the filters of the specific type', async () => {
    // As in, the anyFilters are at the _end_ and not shown at the top.
    await expect(provider).to.complete('{{ string | █ }}', stringFilters.concat(anyFilters));
  });

  describe('when there are no required parameters', () => {
    it('should not include parameters in the insertText of the completion', async () => {
      //                  char 12 ⌄   ⌄ char 16
      const liquid = '{{ string | defa█ }}';

      const textEdit: TextEdit = {
        newText: 'default',
        range: {
          end: { line: 0, character: 16 },
          start: { line: 0, character: 12 },
        },
      };

      await expect(provider).to.complete(liquid, [
        expect.objectContaining({
          label: 'default',
          insertTextFormat: InsertTextFormat.PlainText,
          textEdit,
        }),
      ]);

      const textDocument = TextDocument.create('', 'liquid', 0, liquid.replace(CURSOR, ''));

      expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe('{{ string | default }}');
    });
  });

  describe('when there are required positional parameters', () => {
    it('should include parameters in the insertText of the completion', async () => {
      //                  char 12 ⌄  ⌄ char 15
      const liquid = '{{ string | hig█ }}';

      const textEdit: TextEdit = {
        newText: "highlight: '${1:highlighted_term}'",
        range: {
          end: { line: 0, character: 15 },
          start: { line: 0, character: 12 },
        },
      };

      await expect(provider).to.complete(liquid, [
        expect.objectContaining({
          label: 'highlight',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit,
        }),
      ]);

      const textDocument = TextDocument.create('', 'liquid', 0, liquid.replace(CURSOR, ''));

      expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
        "{{ string | highlight: '${1:highlighted_term}' }}",
      );
    });
  });

  describe('when there are required named parameters', () => {
    it('should include parameters in the insertText of the completion', async () => {
      //                  char 12 ⌄  ⌄ char 15
      const liquid = '{{ string | pre█ }}';

      const textEdit: TextEdit = {
        newText: "preload_tag: as: '$1'",
        range: {
          end: { line: 0, character: 15 },
          start: { line: 0, character: 12 },
        },
      };

      await expect(provider).to.complete(liquid, [
        expect.objectContaining({
          label: 'preload_tag',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit,
        }),
      ]);

      const textDocument = TextDocument.create('', 'liquid', 0, liquid.replace(CURSOR, ''));

      expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
        "{{ string | preload_tag: as: '$1' }}",
      );
    });
  });

  describe('when the cursor is in the middle of the filter', () => {
    describe('and the filter can only be completed to the same name', () => {
      it('sets the range to only the existing name', async () => {
        //                  char 12 ⌄          ⌄ char 23
        const liquid = '{{ string | prel█oad_tag: as: "p" }}';

        const textEdit: TextEdit = {
          newText: 'preload_tag',
          range: {
            end: { line: 0, character: 23 },
            start: { line: 0, character: 12 },
          },
        };

        await expect(provider).to.complete(liquid, [
          expect.objectContaining({
            label: 'preload_tag',
            insertTextFormat: InsertTextFormat.PlainText,
            textEdit,
          }),
        ]);

        const textDocument = TextDocument.create('', 'liquid', 0, liquid.replace(CURSOR, ''));

        expect(TextDocument.applyEdits(textDocument, [textEdit])).toBe(
          '{{ string | preload_tag: as: "p" }}',
        );
      });
    });

    describe('and the filter to be replaced has parameters', () => {
      it('sets the range to include the parameters if replacing with a different filter', async () => {
        //                  char 12 ⌄            ⌄ char 25
        const liquid = '{{ string | d█efault: true }}';
        //                                 ⌃ char 19

        const downcaseTextEdit: TextEdit = {
          newText: 'downcase',
          range: {
            end: { line: 0, character: 25 },
            start: { line: 0, character: 12 },
          },
        };

        const defaultTextEdit: TextEdit = {
          newText: 'default',
          range: {
            end: { line: 0, character: 19 },
            start: { line: 0, character: 12 },
          },
        };

        await expect(provider).to.complete(liquid, [
          expect.objectContaining({
            label: 'downcase',
            insertTextFormat: InsertTextFormat.PlainText,
            textEdit: downcaseTextEdit,
          }),
          expect.objectContaining({
            label: 'default',
            insertTextFormat: InsertTextFormat.PlainText,
            textEdit: defaultTextEdit,
          }),
        ]);

        const textDocument = TextDocument.create('', 'liquid', 0, liquid.replace(CURSOR, ''));

        expect(TextDocument.applyEdits(textDocument, [downcaseTextEdit])).toBe(
          '{{ string | downcase }}',
        );

        expect(TextDocument.applyEdits(textDocument, [defaultTextEdit])).toBe(
          '{{ string | default: true }}',
        );
      });
    });
  });
});

function filtersNamesOfInputType(inputType: string): string[] {
  return filters
    .filter((x) => x.syntax?.startsWith(inputType))
    .map((x) => x.name)
    .sort();
}
