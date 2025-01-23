import { describe, it, expect, assert, beforeEach } from 'vitest';
import { JSONLanguageService } from '../../JSONLanguageService';
import { DocumentManager } from '../../../documents';
import {
  getRequestParams,
  isCompletionList,
  mockJSONLanguageService,
} from '../../test/test-helpers';

describe('Unit: SettingsPropertyCompletionProvider', () => {
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
        label: 'preset',
        schemaTemplate: (setting: object) => {
          return {
            presets: [setting],
          };
        },
      },
      {
        label: 'default',
        schemaTemplate: (setting: object) => {
          return {
            default: setting,
          };
        },
      },
    ];

    for (const test of tests) {
      describe(`${test.label} settings`, () => {
        it(`completes ${test.label} setting property when settings exist`, async () => {
          const schema = {
            settings: [{ id: 'custom-setting' }, { id: 'fake-setting' }, {}],
            ...test.schemaTemplate({
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
          expect(completions.items).to.have.lengthOf(2);
          expect(completions.items.map((item) => item.label)).to.include.members([
            `"custom-setting"`,
            `"fake-setting"`,
          ]);
        });

        it(`offers no suggestions for ${test.label} setting property when there are no settings`, async () => {
          const schema = {
            ...test.schemaTemplate({
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
          expect(completions.items.map((item) => item.label)).to.include.members([]);
        });

        it(`offers ${test.label} setting completion with docs from setting.label`, async () => {
          const schema = {
            settings: [
              { id: 'custom-setting', label: 'Custom Setting' },
              { id: 'fake-setting', label: 't:general.fake' },
              {},
            ],
            ...test.schemaTemplate({
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
          expect(completions.items).to.have.lengthOf(2);
          expect(completions.items).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                documentation: { kind: 'markdown', value: 'Custom Setting' },
              }),
              expect.objectContaining({
                documentation: { kind: 'markdown', value: 'Fake Setting' },
              }),
            ]),
          );
        });
      });
    }

    describe('block file with valid schema', () => {
      it(`offers no suggestions for default setting property when file is block`, async () => {
        const source = `
          {% schema %}
          {
            "settings": [
              {"id": "custom-setting"},
              {"id": "fake-setting"},
              {},
            ],
            "default": {
              "settings": {
                "█": ""
              }
            }
          }
          {% endschema %}
        `;
        const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
        const completions = await jsonLanguageService.completions(params);

        assert(isCompletionList(completions));
        expect(completions.items).to.have.lengthOf(0);
        expect(completions.items.map((item) => item.label)).to.include.members([]);
      });
    });
  });

  describe('invalid schema', () => {
    it('completes preset setting property when settings exist and schema has small errors', async () => {
      const source = `
        {% schema %}
        {
          "settings": [
            {"id": "custom-setting"},
            {"id": "fake-setting"},
            {},
          ],
          "presets": [{
            "settings": {
              "█"
            }
          }]
        }
        {% endschema %}
      `;
      const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
      const completions = await jsonLanguageService.completions(params);

      assert(isCompletionList(completions));
      expect(completions.items).to.have.lengthOf(2);
      expect(completions.items.map((item) => item.label)).to.include.members([
        `"custom-setting"`,
        `"fake-setting"`,
      ]);
    });
  });
});
