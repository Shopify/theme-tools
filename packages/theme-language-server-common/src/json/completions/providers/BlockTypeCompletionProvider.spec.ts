import { describe, it, expect, assert, beforeEach } from 'vitest';
import { JSONLanguageService } from '../../JSONLanguageService';
import { DocumentManager } from '../../../documents';
import { getRequestParams, isCompletionList } from '../../test/test-helpers';

/**
 * We only need this because I want to show in the test that @theme and @app are
 * completed by the schema... If you write a test that doesn't have a JOIN on
 * the completions, feel free to not copy paste this...
 */
const simplifiedBlockSchema = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            oneOf: [
              // blocks[].type is @app, @theme or a string
              { const: '@app' },
              { const: '@theme' },
              {
                if: { not: { enum: ['@theme', '@app'] } },
                then: { type: 'string' },
              },
            ],
          },
        },
      },
    },
  },
});

describe('Unit: BlockTypeCompletionProvider', () => {
  let jsonLanguageService: JSONLanguageService;
  let documentManager: DocumentManager;
  const blockNames = ['block-1', 'block-2', 'custom-block'];

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
            schema: simplifiedBlockSchema,
            fileMatch: ['**/{blocks,sections}/*.liquid'], // cheating a little here...
          },
        ],
      },
      async () => ({}),
      async () => 'theme',
      async () => blockNames,
      async () => undefined,
      async () => 'file:///test-root',
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

  describe('when there are no local blocks', () => {
    it('completes theme block names', async () => {
      const source = `
      hello world
      {% schema %}
      {
        "blocks": [
          { "type": "█" }
        ]
      }
      {% endschema %}
      `;
      const params = getRequestParams(documentManager, 'sections/section.liquid', source);

      const completions = await jsonLanguageService.completions(params);

      assert(isCompletionList(completions));
      // @app & @theme come from the JSON schema. There's no way to not include them.
      expect(completions.items).to.have.lengthOf(blockNames.length + ['@app', '@theme'].length);
      expect(completions.items.map((item) => item.label)).to.include.members([
        '"@app"',
        '"@theme"',
        ...blockNames.map((x) => `"${x}"`),
      ]);
    });
  });

  describe('when there are local blocks', () => {
    it('does not completes theme block names', async () => {
      const source = `
      hello world
      {% schema %}
      {
        "blocks": [
          { "type": "user-defined", "name": "user defined" }
          { "type": "█" }
        ]
      }
      {% endschema %}
      `;
      const params = getRequestParams(documentManager, 'sections/section.liquid', source);

      const completions = await jsonLanguageService.completions(params);

      assert(isCompletionList(completions));
      expect(completions.items).to.have.lengthOf(['@app', '@theme'].length);
      expect(completions.items.map((item) => item.label)).not.to.include.members([
        ...blockNames.map((x) => `"${x}"`),
      ]);
    });
  });
});
