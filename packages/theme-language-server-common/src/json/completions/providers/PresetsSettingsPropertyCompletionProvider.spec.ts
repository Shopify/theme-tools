import { describe, it, expect, assert, beforeEach } from 'vitest';
import { JSONLanguageService } from '../../JSONLanguageService';
import { DocumentManager } from '../../../documents';
import {
  getRequestParams,
  isCompletionList,
  mockJSONLanguageService,
} from '../../test/test-helpers';

describe('Unit: PresetsSettingsPropertyCompletionProvider', () => {
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
      async (uri: string) => ({
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

  describe('valid schema', () => {
    it('completes preset setting property when settings exist', async () => {
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
              "█": "",
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

    it('offers no suggestions for preset setting property when there are no settings', async () => {
      const source = `
        {% schema %}
        {
          "presets": [{
            "settings": {
              "█": "",
            }
          }]
        }
        {% endschema %}
      `;
      const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
      const completions = await jsonLanguageService.completions(params);

      assert(isCompletionList(completions));
      expect(completions.items).to.have.lengthOf(0);
      expect(completions.items.map((item) => item.label)).to.include.members([]);
    });

    it('offers presets setting completion with docs from setting.label', async () => {
      const source = `
        {% schema %}
        {
          "settings": [
            {"id": "custom-setting", "label": "Custom Setting"},
            {"id": "fake-setting", "label": "t:general.fake"},
          ],
          "presets": [{
            "settings": {
              "█": "",
            }
          }]
        }
        {% endschema %}
      `;
      const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
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
