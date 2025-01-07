import { describe, it, expect, assert, beforeEach } from 'vitest';
import { JSONLanguageService } from '../../JSONLanguageService';
import { DocumentManager } from '../../../documents';
import { getRequestParams, isCompletionList } from '../../test/test-helpers';
import { SourceCodeType, ThemeBlock } from '@shopify/theme-check-common';

describe('Unit: PresetsBlockTypeCompletionProvider', () => {
  const rootUri = 'file:///root/';
  let jsonLanguageService: JSONLanguageService;
  let documentManager: DocumentManager;

  beforeEach(async () => {
    documentManager = new DocumentManager(
      undefined, // don't need a fs
      undefined, // don't need a connection
      undefined, // don't need client capabilities
      async () => 'theme', // 'theme' mode
      async () => false, // schema is invalid for tests
    );
    jsonLanguageService = new JSONLanguageService(
      documentManager,
      {
        schemas: async () => [
          {
            uri: 'https://shopify.dev/block-schema.json',
            schema: JSON.stringify({
              $schema: 'http://json-schema.org/draft-07/schema#',
            }),
            fileMatch: ['**/{blocks,sections}/*.liquid'],
          },
        ],
      },
      async () => ({}),
      async () => 'theme',
      async () => ['block-1', 'block-2', 'custom-block'],
      async (_uri: string, name: string) => {
        const blockUri = `${rootUri}/blocks/${name}.liquid`;
        const doc = documentManager.get(blockUri);
        if (!doc || doc.type !== SourceCodeType.LiquidHtml) {
          return;
        }
        return doc.getSchema();
      },
    );

    await jsonLanguageService.setup({
      textDocument: {
        completion: {
          contextSupport: true,
          completionItem: {
            snippetSupport: true,
            commitCharactersSupport: true,
            documentationFormat: ['markdown'],
            deprecatedSupport: true,
            preselectSupport: true,
          },
        },
      },
    });
  });

  const tests = [
    {
      description: 'select blocks',
      configured: [{ type: 'block-1' }],
      expected: [`"block-1"`],
    },
    {
      description: '@theme block',
      configured: [{ type: '@theme' }],
      expected: [`"block-1"`, `"block-2"`, `"custom-block"`],
    },
    {
      description: '@app block',
      configured: [{ type: '@app' }],
      expected: [],
    },
    {
      description: 'no blocks',
      configured: [],
      expected: [],
    },
  ];

  describe('top-level preset blocks', () => {
    for (const test of tests) {
      it(`completes preset block type when allowed ${test.description}`, async () => {
        const source = `
          {% schema %}
          {
            "blocks": ${JSON.stringify(test.configured)},
            "presets": [{
              "blocks": [
                { "type": "█" },
              ]
            }]
          }
          {% endschema %}
        `;

        const params = getRequestParams(documentManager, 'sections/section.liquid', source);
        const completions = await jsonLanguageService.completions(params);

        assert(isCompletionList(completions));
        expect(completions.items).to.have.lengthOf(test.expected.length);
        expect(completions.items.map((item) => item.label)).to.include.members(test.expected);
      });
    }
  });

  describe('nested preset blocks', () => {
    for (const test of tests) {
      it(`completes preset block type when parent block allows ${test.description}`, async () => {
        const source = `
          {% schema %}
          {
            "blocks": [{"type": "custom-block"}],
            "presets": [{
              "blocks": [
                {
                  "type": "custom-block",
                  "blocks": [{"type": "█"}],
                },
              ]
            }]
          }
          {% endschema %}
        `;

        documentManager.open(
          `${rootUri}/blocks/custom-block.liquid`,
          `{% schema %}
            {
              "blocks": ${JSON.stringify(test.configured)}
            }
          {% endschema %}`,
          1,
        );

        const params = getRequestParams(documentManager, 'sections/section.liquid', source);
        const completions = await jsonLanguageService.completions(params);

        assert(isCompletionList(completions));
        expect(completions.items).to.have.lengthOf(test.expected.length);
        expect(completions.items.map((item) => item.label)).to.include.members(test.expected);
      });
    }
  });

  describe('invalid schema', () => {
    it('does not complete when schema is invalid', async () => {
      const source = `
        {% schema %}
        typo
        {
          "blocks": [{"type": "@theme"}],
          "presets": [{
            "blocks": [
              { "type": "█" },
            ]
          }]
        }
        {% endschema %}
      `;

      const params = getRequestParams(documentManager, 'sections/section.liquid', source);
      const completions = await jsonLanguageService.completions(params);

      assert(isCompletionList(completions));
      expect(completions.items).to.have.lengthOf(0);
    });

    it('does not complete when parent block schema is invalid', async () => {
      const source = `
        {% schema %}
        {
          "blocks": [{"type": "custom-block"}],
          "presets": [{
            "blocks": [
              {
                "type": "custom-block",
                "blocks": [{"type": "█"}],
              },
            ]
          }]
        }
        {% endschema %}
      `;

      documentManager.open(
        `${rootUri}/blocks/custom-block.liquid`,
        `{% schema %}
          typo
          {
            "blocks": [{"type": "@theme"}]
          }
        {% endschema %}`,
        1,
      );

      const params = getRequestParams(documentManager, 'sections/section.liquid', source);
      const completions = await jsonLanguageService.completions(params);

      assert(isCompletionList(completions));
      expect(completions.items).to.have.lengthOf(0);
    });
  });
});
