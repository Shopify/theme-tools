import { describe, it, expect, assert, beforeEach } from 'vitest';
import { JSONLanguageService } from '../../JSONLanguageService';
import { DocumentManager } from '../../../documents';
import {
  getRequestParams,
  isCompletionList,
  mockJSONLanguageService,
} from '../../test/test-helpers';

describe('Unit: BlockSettingsPropertyCompletionProvider', () => {
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
    jsonLanguageService = mockJSONLanguageService(
      rootUri,
      documentManager,
      async (_uri: string) => ({
        general: {
          fake: 'Fake Setting',
        },
      }),
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

  describe('section file with valid schema', () => {
    const tests = [
      {
        label: 'presets',
        schemaTemplate: (referencedBlock: object) => {
          return {
            presets: [
              {
                blocks: [referencedBlock],
              },
            ],
          };
        },
      },
      {
        label: 'default',
        schemaTemplate: (referencedBlock: object) => {
          return {
            default: {
              blocks: [referencedBlock],
            },
          };
        },
      },
    ];

    for (const test of tests) {
      describe(`${test.label} block settings`, () => {
        beforeEach(() => {
          const testBlockSchema = {
            settings: [
              { id: 'custom-setting', label: 'Custom Setting' },
              { id: 'fake-setting', label: 't:general.fake' },
              { id: 'no-label' },
              { nope: 'no-id' },
            ],
          };
          documentManager.open(`${rootUri}/blocks/test-block.liquid`, toSource(testBlockSchema), 1);
          documentManager.open(`${rootUri}/blocks/no-settings-block.liquid`, toSource({}), 1);
        });

        it(`completes ${test.label} block settings property when settings exist`, async () => {
          const schema = {
            ...test.schemaTemplate({
              type: 'test-block',
              settings: {
                '█': '',
              },
            }),
          };
          const params = getRequestParams(
            documentManager,
            'sections/section.liquid',
            toSource(schema),
          );
          const completions = await jsonLanguageService.completions(params);

          assert(isCompletionList(completions));
          expect(completions.items).to.have.lengthOf(3);
          expect(completions.items).toContainEqual(
            expect.objectContaining({
              insertText: `"custom-setting"`,
              documentation: expect.objectContaining({
                value: 'Custom Setting',
              }),
            }),
          );
          expect(completions.items).toContainEqual(
            expect.objectContaining({
              insertText: `"fake-setting"`,
              documentation: expect.objectContaining({
                value: 'Fake Setting',
              }),
            }),
          );
          expect(completions.items).toContainEqual(
            expect.objectContaining({
              insertText: `"no-label"`,
              documentation: expect.objectContaining({
                value: '',
              }),
            }),
          );
        });

        it(`offers no suggestions for ${test.label} block settings property when there are no settings`, async () => {
          const schema = {
            ...test.schemaTemplate({
              type: 'no-settings-block',
              settings: {
                '█': '',
              },
            }),
          };
          const source = `
            {% schema %}
              ${JSON.stringify(schema)}
            {% endschema %}
          `;
          const params = getRequestParams(documentManager, 'sections/section.liquid', source);
          const completions = await jsonLanguageService.completions(params);

          assert(isCompletionList(completions));
          expect(completions.items).to.have.lengthOf(0);
        });
      });
    }
  });
});

function toSource(schema: object) {
  return `{% schema %}
  ${JSON.stringify(schema)}
{% endschema %}`;
}
