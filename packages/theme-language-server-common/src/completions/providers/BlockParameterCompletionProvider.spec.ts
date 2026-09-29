import { beforeEach, describe, expect, it } from 'vitest';
import {
  MetafieldDefinitionMap,
  ObjectEntry,
  SourceCodeType,
  Translations,
} from '@shopify/theme-check-common';
import {
  CompletionItemKind,
  InsertTextFormat,
  MarkupContent,
  MarkupKind,
  TextEdit,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../../hover';
import { CompletionsProvider } from '../CompletionsProvider';

const template = (source: string) => ({ source, relativePath: 'templates/index.liquid' });

const CONTENT_PRECEDENCE_NOTE =
  'A non-empty block body supplies `content` and takes precedence over a `content:` argument.';
const SCHEMA_TRANSLATIONS: Translations = {
  settings: { heading: { label: 'Translated heading', info: 'Translated info' } },
};

describe('Module: BlockParameterCompletionProvider', () => {
  let documentManager: DocumentManager;
  let provider: CompletionsProvider;

  beforeEach(() => {
    documentManager = new DocumentManager(
      undefined,
      undefined,
      undefined,
      async () => 'theme',
      async () => true,
    );
    provider = createProvider(documentManager);
  });

  describe('when the target block has schema settings and LiquidDoc', () => {
    beforeEach(() => {
      openBlock(
        documentManager,
        'card',
        blockSource(
          [
            { id: 'heading', type: 'text', label: 'Heading', info: 'Shown above the card' },
            { id: 'featured', type: 'product', label: 'Featured product' },
          ],
          ['@param {string} tracking_id - Analytics identifier'],
        ),
      );
    });

    it('offers schema setting IDs, LiquidDoc-only parameters, and content in one list', async () => {
      await expect(provider).to.complete(template(`{% block 'card', █ %}{% endblock %}`), [
        'content',
        'heading',
        'featured',
        'tracking_id',
      ]);
    });

    it('describes each parameter with markdown documentation', async () => {
      await expect(provider).to.complete(
        template(`{% block 'card', █ %}{% endblock %}`),
        expect.arrayContaining([
          expect.objectContaining({
            label: 'heading',
            kind: CompletionItemKind.Property,
            documentation: {
              kind: MarkupKind.Markdown,
              value: [
                '### heading (Optional): `string`',
                '**Theme setting**\n\nHeading\n\nShown above the card',
              ].join('\n\n'),
            },
          }),
          expect.objectContaining({
            label: 'tracking_id',
            kind: CompletionItemKind.Property,
            documentation: {
              kind: MarkupKind.Markdown,
              value: '### tracking_id: `string`\n\nAnalytics identifier',
            },
          }),
        ]),
      );
    });

    it('uses the completion documentation as the hover description', async () => {
      const hoverProvider = createHoverProvider(documentManager);
      const [completionItem] = await completionItems(
        provider,
        `{% block 'card', hea█ %}{% endblock %}`,
      );
      const hover = await hoverAt(
        hoverProvider,
        `{% block 'card', hea█ding: 'Sale' %}{% endblock %}`,
      );

      expect(completionItem.label).toBe('heading');
      expect(hover).toBe((completionItem.documentation as MarkupContent).value);
    });

    it('inserts a value template derived from the schema type', async () => {
      //                               char 17 ⌄
      const source = `{% block 'card', █ %}{% endblock %}`;
      const at17 = { start: { line: 0, character: 17 }, end: { line: 0, character: 17 } };

      await expect(provider).to.complete(template(source), [
        expect.objectContaining({
          label: 'content',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: { range: at17, newText: "content: '$1'$0" },
        }),
        expect.objectContaining({
          label: 'heading',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: { range: at17, newText: "heading: '$1'$0" },
        }),
        expect.objectContaining({
          label: 'featured',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: { range: at17, newText: 'featured: ${1:}$0' },
        }),
        expect.objectContaining({
          label: 'tracking_id',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: { range: at17, newText: "tracking_id: '$1'$0" },
        }),
      ]);
    });

    it('does not offer arguments that the call already passes', async () => {
      await expect(provider).to.complete(
        template(`{% block 'card', heading: 'Sale', tracking_id: 'x', █ %}{% endblock %}`),
        ['content', 'featured'],
      );
    });

    it('does not offer content when the call has a non-empty body', async () => {
      await expect(provider).to.complete(
        template(`{% block 'card', █ %}<p>Body</p>{% endblock %}`),
        ['heading', 'featured', 'tracking_id'],
      );
    });

    it('offers content when the body is whitespace only', async () => {
      await expect(provider).to.complete(template(`{% block 'card', █ %}\n  \n{% endblock %}`), [
        'content',
        'heading',
        'featured',
        'tracking_id',
      ]);
    });

    it('filters by a partially typed argument name and replaces the partial', async () => {
      //                                char 17 ⌄ ⌄ char 19
      const source = `{% block 'card', he█ %}{% endblock %}`;
      const textEdit: TextEdit = {
        range: { start: { line: 0, character: 17 }, end: { line: 0, character: 19 } },
        newText: "heading: '$1'$0",
      };

      await expect(provider).to.complete(template(source), [
        expect.objectContaining({
          label: 'heading',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit,
        }),
      ]);
      expect(applyEdit(source, textEdit)).toBe(`{% block 'card', heading: '$1'$0 %}{% endblock %}`);
    });

    it('replaces only the name of an existing argument', async () => {
      //                                char 17 ⌄      ⌄ char 24
      const source = `{% block 'card', hea█ding: 'Sale' %}{% endblock %}`;
      const textEdit: TextEdit = {
        range: { start: { line: 0, character: 17 }, end: { line: 0, character: 24 } },
        newText: 'heading',
      };

      await expect(provider).to.complete(template(source), [
        expect.objectContaining({
          label: 'heading',
          insertTextFormat: InsertTextFormat.PlainText,
          textEdit,
        }),
      ]);
      expect(applyEdit(source, textEdit)).toBe(`{% block 'card', heading: 'Sale' %}{% endblock %}`);
    });

    it('inserts a new argument before an existing one', async () => {
      //                               char 17 ⌄
      const source = `{% block 'card', █heading: 'Sale' %}{% endblock %}`;
      const textEdit: TextEdit = {
        range: { start: { line: 0, character: 17 }, end: { line: 0, character: 17 } },
        newText: 'featured: ${1:}$0, ',
      };

      await expect(provider).to.complete(
        template(source),
        expect.arrayContaining([expect.objectContaining({ label: 'featured', textEdit })]),
      );
      await expect(provider).to.complete(template(source), ['content', 'featured', 'tracking_id']);
      expect(applyEdit(source, textEdit)).toBe(
        `{% block 'card', featured: \${1:}$0, heading: 'Sale' %}{% endblock %}`,
      );
    });

    it('completes an empty slot in multiline arguments', async () => {
      const source = [
        `{% block 'card',`,
        `  heading: 'Sale',`,
        `  █`,
        `  tracking_id: 'x'`,
        `%}{% endblock %}`,
      ].join('\n');
      const textEdit: TextEdit = {
        range: { start: { line: 2, character: 2 }, end: { line: 2, character: 2 } },
        newText: 'featured: ${1:}$0,',
      };

      await expect(provider).to.complete(template(source), [
        expect.objectContaining({ label: 'content' }),
        expect.objectContaining({ label: 'featured', textEdit }),
      ]);
      expect(applyEdit(source, textEdit)).toBe(
        [
          `{% block 'card',`,
          `  heading: 'Sale',`,
          `  featured: \${1:}$0,`,
          `  tracking_id: 'x'`,
          `%}{% endblock %}`,
        ].join('\n'),
      );
    });

    it('completes a partial name in multiline markup that does not parse yet', async () => {
      const source = [`{% block 'card',`, `  heading: 'Sale',`, `  fe█`, `%}{% endblock %}`].join(
        '\n',
      );

      await expect(provider).to.complete(template(source), [
        expect.objectContaining({
          label: 'featured',
          textEdit: {
            range: { start: { line: 2, character: 2 }, end: { line: 2, character: 4 } },
            newText: 'featured: ${1:}$0',
          },
        }),
      ]);
    });

    it('excludes existing arguments when the markup does not parse yet', async () => {
      await expect(provider).to.complete(
        template(`{% block 'card', heading: 'Sale', █, tracking_id: 'x' %}{% endblock %}`),
        ['content', 'featured'],
      );
    });

    it.each([
      [`{% block 'card', █`, ['content', 'heading', 'featured', 'tracking_id']],
      [`{% block 'card', heading: 'Sale', █`, ['content', 'featured', 'tracking_id']],
      [`{% block 'card', heading: 'Sale', t█`, ['tracking_id']],
    ])('completes argument names in an unclosed tag: %s', async (source, labels) => {
      await expect(provider).to.complete(template(source), labels);
    });

    it('offers only plain parameter names, never block.settings or block.content', async () => {
      await expect(provider).to.complete(template(`{% block 'card', █ %}{% endblock %}`), [
        'content',
        'heading',
        'featured',
        'tracking_id',
      ]);
      await expect(provider).to.complete(template(`{% block 'card', block.█ %}{% endblock %}`), []);
    });

    it.each([
      [`{% block 'card' █ %}{% endblock %}`],
      [`{% block 'card', heading: 'Sale' █ %}{% endblock %}`],
      [`{% block 'card', heading: █ %}{% endblock %}`],
      [`{% block 'card', heading: pro█ %}{% endblock %}`],
    ])('does not offer parameters outside an argument-name slot: %s', async (source) => {
      await expect(provider).to.complete(template(source), []);
    });

    it('reads the latest version of the target block', async () => {
      const source = template(`{% block 'card', █ %}{% endblock %}`);
      await expect(provider).to.complete(source, ['content', 'heading', 'featured', 'tracking_id']);

      documentManager.change(
        'file:///blocks/card.liquid',
        blockSource([{ id: 'subheading', type: 'text', label: 'Subheading' }]),
        2,
      );

      await expect(provider).to.complete(source, ['content', 'subheading']);
    });
  });

  describe('requiredness', () => {
    it.each([
      ['an implicit platform default', { id: 'value', type: 'checkbox' }, '${1:false}$0'],
      [
        'an explicit default',
        { id: 'value', type: 'range', min: 0, max: 10, step: 1, default: 5 },
        '${1:0}$0',
      ],
      ['a type that does not permit a default', { id: 'value', type: 'image_picker' }, '${1:}$0'],
    ])('marks a schema-only setting with %s optional', async (_case, setting, value) => {
      openBlock(documentManager, 'card', blockSource([setting]));

      await expect(provider).to.complete(template(`{% block 'card', val█ %}{% endblock %}`), [
        expect.objectContaining({
          label: 'value',
          documentation: expect.objectContaining({
            value: expect.stringMatching(/^### value \(Optional\)/),
          }),
          textEdit: expect.objectContaining({ newText: `value: ${value}` }),
        }),
      ]);
    });

    it('uses LiquidDoc requiredness for schema-backed parameters', async () => {
      openBlock(
        documentManager,
        'card',
        blockSource(
          [
            { id: 'heading', type: 'text', label: 'Heading' },
            { id: 'subheading', type: 'text', label: 'Subheading' },
          ],
          ['@param {string} heading - Card heading', '@param {string} [subheading]'],
        ),
      );

      await expect(provider).to.complete(template(`{% block 'card', █ %}{% endblock %}`), [
        expect.objectContaining({ label: 'content' }),
        expect.objectContaining({
          label: 'heading',
          documentation: expect.objectContaining({
            value: ['### heading: `string`', 'Card heading', '**Theme setting**\n\nHeading'].join(
              '\n\n',
            ),
          }),
        }),
        expect.objectContaining({
          label: 'subheading',
          documentation: expect.objectContaining({
            value: expect.stringMatching(/^### subheading \(Optional\): `string`/),
          }),
        }),
      ]);
    });

    it('returns one item with the schema type for a compatible duplicate', async () => {
      openBlock(
        documentManager,
        'card',
        blockSource(
          [{ id: 'featured', type: 'product', label: 'Featured product' }],
          ['@param {object} featured - The product to feature'],
        ),
      );

      await expect(provider).to.complete(template(`{% block 'card', fe█ %}{% endblock %}`), [
        expect.objectContaining({
          label: 'featured',
          documentation: expect.objectContaining({
            value: [
              '### featured: `product`',
              'The product to feature',
              '**Theme setting**\n\nFeatured product',
            ].join('\n\n'),
          }),
          textEdit: expect.objectContaining({ newText: 'featured: ${1:}$0' }),
        }),
      ]);
    });

    it('offers built-in content as an optional string', async () => {
      openBlock(documentManager, 'card', blockSource([]));

      await expect(provider).to.complete(template(`{% block 'card', █ %}{% endblock %}`), [
        expect.objectContaining({
          label: 'content',
          documentation: expect.objectContaining({
            value: ['### content (Optional): `string`', CONTENT_PRECEDENCE_NOTE].join('\n\n'),
          }),
          textEdit: expect.objectContaining({ newText: "content: '$1'$0" }),
        }),
      ]);
    });

    it('uses LiquidDoc requiredness for content', async () => {
      openBlock(documentManager, 'card', blockSource([], ['@param {string} content - Card body']));

      await expect(provider).to.complete(template(`{% block 'card', █ %}{% endblock %}`), [
        expect.objectContaining({
          label: 'content',
          documentation: expect.objectContaining({
            value: ['### content: `string`', 'Card body', CONTENT_PRECEDENCE_NOTE].join('\n\n'),
          }),
        }),
      ]);
    });
  });

  describe('schema setting translations', () => {
    it('keeps literal label and info unchanged', async () => {
      openBlock(
        documentManager,
        'card',
        blockSource([
          { id: 'heading', type: 'text', label: 'Heading', info: 'Uses t:settings syntax' },
        ]),
      );

      await expect(provider).to.complete(template(`{% block 'card', hea█ %}{% endblock %}`), [
        expect.objectContaining({
          label: 'heading',
          documentation: expect.objectContaining({
            value: [
              '### heading (Optional): `string`',
              '**Theme setting**\n\nHeading\n\nUses t:settings syntax',
            ].join('\n\n'),
          }),
        }),
      ]);
    });

    it('resolves translated label and info', async () => {
      openBlock(
        documentManager,
        'card',
        blockSource([
          {
            id: 'heading',
            type: 'text',
            label: 't:settings.heading.label',
            info: 't:settings.heading.info',
          },
        ]),
      );

      await expect(provider).to.complete(template(`{% block 'card', hea█ %}{% endblock %}`), [
        expect.objectContaining({
          label: 'heading',
          documentation: expect.objectContaining({
            value: [
              '### heading (Optional): `string`',
              '**Theme setting**\n\nTranslated heading\n\nTranslated info',
            ].join('\n\n'),
          }),
        }),
      ]);
    });

    it('omits a translation key that has no translation', async () => {
      openBlock(
        documentManager,
        'card',
        blockSource([
          {
            id: 'heading',
            type: 'text',
            label: 't:settings.missing.label',
            info: 't:settings.missing.info',
          },
        ]),
      );

      await expect(provider).to.complete(template(`{% block 'card', hea█ %}{% endblock %}`), [
        expect.objectContaining({
          label: 'heading',
          documentation: expect.objectContaining({
            value: '### heading (Optional): `string`\n\n**Theme setting**',
          }),
        }),
      ]);
    });
  });

  describe('when the tag cannot be resolved', () => {
    it('offers nothing for a missing target block', async () => {
      await expect(provider).to.complete(template(`{% block 'missing', █ %}{% endblock %}`), []);
    });
  });

  describe('block tag completion', () => {
    beforeEach(() => {
      provider = createProvider(documentManager, { tags: [{ name: 'block' }] });
      openBlock(documentManager, 'card', blockSource([{ id: 'heading', type: 'text' }]));
    });

    it('does not offer the block tag in an argument slot of an existing block tag', async () => {
      await expect(provider).to.complete(template(`{% block 'card', █ %}{% endblock %}`), [
        'content',
        'heading',
      ]);
    });

    it('offers the block tag in the body of an existing block tag', async () => {
      await expect(provider).to.complete(
        template(`{% block 'card', heading: 'Sale' %}{% bl█ %}{% endblock %}`),
        ['block'],
      );
    });
  });

  describe('when completing block.settings in the target block', () => {
    beforeEach(() => {
      provider = createProvider(documentManager, { objects: [blockObject] });
    });

    it('offers the schema setting IDs with their schema-derived types', async () => {
      await expect(provider).to.complete(
        {
          relativePath: 'blocks/card.liquid',
          source: [
            '{{ block.settings.█ }}',
            blockSource([
              { id: 'heading', type: 'text', label: 'Heading' },
              { id: 'featured', type: 'product', label: 'Featured product' },
            ]),
          ].join('\n'),
        },
        [
          expect.objectContaining({
            label: 'featured',
            documentation: { kind: MarkupKind.Markdown, value: '### featured: `product`' },
          }),
          expect.objectContaining({
            label: 'heading',
            documentation: { kind: MarkupKind.Markdown, value: '### heading: `string`' },
          }),
        ],
      );
    });
  });
});

const blockObject: ObjectEntry = {
  name: 'block',
  access: { global: false, parents: [], template: [] },
  return_type: [],
  properties: [{ name: 'settings', return_type: [{ type: 'untyped', name: '' }] }],
};

function createProvider(
  documentManager: DocumentManager,
  { tags = [], objects = [] }: { tags?: { name: string }[]; objects?: ObjectEntry[] } = {},
) {
  return new CompletionsProvider({
    documentManager,
    themeDocset: {
      filters: async () => [],
      objects: async () => objects,
      liquidDrops: async () => objects,
      tags: async () => tags,
      systemTranslations: async () => ({}),
    },
    getMetafieldDefinitions: async (_rootUri: string) => ({}) as MetafieldDefinitionMap,
    getSchemaTranslationsForURI: async () => SCHEMA_TRANSLATIONS,
    findThemeRootURI: async (_uri: string) => 'file:///path/to',
    getThemeBlockSchema: async (_uri, name) => {
      const block = documentManager.get(blockUri(name));
      if (block?.type !== SourceCodeType.LiquidHtml) return undefined;
      return block.getSchema();
    },
    getDocDefinitionForURI: async (_uri, _category, name) => {
      const block = documentManager.get(blockUri(name));
      if (block?.type !== SourceCodeType.LiquidHtml) return undefined;
      return block.getLiquidDoc();
    },
  });
}

function createHoverProvider(documentManager: DocumentManager) {
  return new HoverProvider(
    documentManager,
    {
      filters: async () => [],
      objects: async () => [],
      liquidDrops: async () => [],
      tags: async () => [],
      systemTranslations: async () => ({}),
    },
    async (_rootUri: string) => ({}) as MetafieldDefinitionMap,
    async () => ({}),
    async () => [],
    async (_uri, _category, name) => {
      const block = documentManager.get(blockUri(name));
      if (block?.type !== SourceCodeType.LiquidHtml) return undefined;
      return block.getLiquidDoc();
    },
    async () => 'theme',
    async (_uri, name) => {
      const block = documentManager.get(blockUri(name));
      if (block?.type !== SourceCodeType.LiquidHtml) return undefined;
      return block.getSchema();
    },
    async () => SCHEMA_TRANSLATIONS,
  );
}

async function completionItems(provider: CompletionsProvider, source: string) {
  const position = openTemplate(provider.documentManager, source);
  return provider.completions({ textDocument: { uri: TEMPLATE_URI }, position });
}

async function hoverAt(provider: HoverProvider, source: string) {
  const position = openTemplate(provider.documentManager, source);
  const hover = await provider.hover({ textDocument: { uri: TEMPLATE_URI }, position });
  return (hover?.contents as MarkupContent | undefined)?.value;
}

const TEMPLATE_URI = 'file:///templates/index.liquid';

function openTemplate(documentManager: DocumentManager, source: string) {
  documentManager.open(TEMPLATE_URI, source.replace('█', ''), 0);
  return documentManager.get(TEMPLATE_URI)!.textDocument.positionAt(source.indexOf('█'));
}

function openBlock(documentManager: DocumentManager, name: string, source: string) {
  documentManager.open(blockUri(name), source, 1);
}

function blockUri(name: string) {
  return `file:///blocks/${name}.liquid`;
}

function blockSource(settings: Record<string, unknown>[], params: string[] = []): string {
  return [
    ...(params.length > 0
      ? ['{% doc %}', ...params.map((param) => `  ${param}`), '{% enddoc %}']
      : []),
    '{% schema %}',
    JSON.stringify({ name: 'Card', settings }),
    '{% endschema %}',
  ].join('\n');
}

function applyEdit(source: string, textEdit: TextEdit) {
  const textDocument = TextDocument.create('', 'liquid', 0, source.replace('█', ''));
  return TextDocument.applyEdits(textDocument, [textEdit]);
}
