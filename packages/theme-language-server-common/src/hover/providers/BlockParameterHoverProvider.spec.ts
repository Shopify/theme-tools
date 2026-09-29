import { beforeEach, describe, expect, it } from 'vitest';
import { MetafieldDefinitionMap, ObjectEntry, SourceCodeType } from '@shopify/theme-check-common';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

const template = (source: string) => ({ source, relativePath: 'templates/index.liquid' });

const HEADING_SETTING = {
  id: 'heading',
  type: 'text',
  label: 'Heading',
  info: 'Shown above the card',
};
const HEADING_MERCHANT_NOTE =
  '**Merchant-facing setting** (`text`)\n- Label: Heading\n- Info: Shown above the card';
const BUILT_IN_CONTENT_NOTE =
  'Built-in parameter. A non-empty block body supplies `content` and takes precedence over a `content:` argument.';

describe('Module: BlockParameterHoverProvider', () => {
  let documentManager: DocumentManager;
  let provider: HoverProvider;

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

  it('describes a schema-only argument as an optional merchant-facing setting', async () => {
    openBlock(documentManager, blockSource([HEADING_SETTING]));

    await expect(provider).to.hover(
      template(`{% block 'card', hea█ding: 'Sale' %}{% endblock %}`),
      ['### `heading` (Optional): string', HEADING_MERCHANT_NOTE].join('\n\n'),
    );
  });

  it('merges a required LiquidDoc echo into one hover', async () => {
    openBlock(
      documentManager,
      blockSource([HEADING_SETTING], ['@param {string} heading - Card heading']),
    );

    await expect(provider).to.hover(
      template(`{% block 'card', hea█ding: 'Sale' %}{% endblock %}`),
      ['### `heading`: string', 'Card heading', HEADING_MERCHANT_NOTE].join('\n\n'),
    );
  });

  it('merges an optional LiquidDoc echo into one hover', async () => {
    openBlock(
      documentManager,
      blockSource([HEADING_SETTING], ['@param {string} [heading] - Card heading']),
    );

    await expect(provider).to.hover(
      template(`{% block 'card', hea█ding: 'Sale' %}{% endblock %}`),
      ['### `heading` (Optional): string', 'Card heading', HEADING_MERCHANT_NOTE].join('\n\n'),
    );
  });

  it('keeps the schema type when LiquidDoc declares a compatible less-specific type', async () => {
    openBlock(
      documentManager,
      blockSource(
        [{ id: 'featured', type: 'product', label: 'Featured product' }],
        ['@param {object} featured - The product to feature'],
      ),
    );

    await expect(provider).to.hover(
      template(`{% block 'card', feat█ured: product %}{% endblock %}`),
      [
        '### `featured`: product',
        'The product to feature',
        '**Merchant-facing setting** (`product`)\n- Label: Featured product',
      ].join('\n\n'),
    );
  });

  it('identifies a LiquidDoc-only parameter as developer-only', async () => {
    openBlock(
      documentManager,
      blockSource([], ['@param {string} tracking_id - Analytics identifier']),
    );

    await expect(provider).to.hover(
      template(`{% block 'card', track█ing_id: 'x' %}{% endblock %}`),
      [
        '### `tracking_id`: string',
        'Analytics identifier',
        'Developer-only LiquidDoc parameter. Not merchant-facing.',
      ].join('\n\n'),
    );
  });

  it('describes built-in content as an optional string', async () => {
    openBlock(documentManager, blockSource([]));

    await expect(provider).to.hover(
      template(`{% block 'card', cont█ent: body %}{% endblock %}`),
      ['### `content` (Optional): string', BUILT_IN_CONTENT_NOTE].join('\n\n'),
    );
  });

  it('uses LiquidDoc requiredness and text for content', async () => {
    openBlock(documentManager, blockSource([], ['@param {string} content - Card body']));

    await expect(provider).to.hover(
      template(`{% block 'card', cont█ent: body %}{% endblock %}`),
      ['### `content`: string', 'Card body', BUILT_IN_CONTENT_NOTE].join('\n\n'),
    );
  });

  it('types schema-backed content as string even when its setting type is not', async () => {
    openBlock(documentManager, blockSource([{ id: 'content', type: 'number', label: 'Body' }]));

    await expect(provider).to.hover(
      template(`{% block 'card', cont█ent: body %}{% endblock %}`),
      [
        '### `content` (Optional): string',
        '**Merchant-facing setting** (`number`)\n- Label: Body',
        BUILT_IN_CONTENT_NOTE,
      ].join('\n\n'),
    );
  });

  it.each([
    [`{% block 'card', unkn█own: 'x' %}{% endblock %}`],
    [`{% block 'card', block.settings.hea█ding: 'x' %}{% endblock %}`],
    [`{% block 'missing', hea█ding: 'x' %}{% endblock %}`],
  ])('returns null for an argument outside the interface: %s', async (source) => {
    openBlock(documentManager, blockSource([HEADING_SETTING]));

    await expect(provider).to.hover(template(source), null);
  });

  describe('when hovering block.settings in the target block', () => {
    beforeEach(() => {
      provider = createProvider(documentManager, [blockObject]);
    });

    it('keeps the schema-derived type', async () => {
      await expect(provider).to.hover(
        {
          relativePath: 'blocks/card.liquid',
          source: ['{{ block.settings.hea█ding }}', blockSource([HEADING_SETTING])].join('\n'),
        },
        '### heading: `string`',
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

function createProvider(documentManager: DocumentManager, objects: ObjectEntry[] = []) {
  return new HoverProvider(
    documentManager,
    {
      filters: async () => [],
      objects: async () => objects,
      liquidDrops: async () => objects,
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
  );
}

function openBlock(documentManager: DocumentManager, source: string) {
  documentManager.open(blockUri('card'), source, 1);
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
