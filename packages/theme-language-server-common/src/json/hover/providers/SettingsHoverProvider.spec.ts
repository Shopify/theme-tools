import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../../documents';
import { JSONLanguageService } from '../../JSONLanguageService';
import { getRequestParams, mockJSONLanguageService } from '../../test/test-helpers';

describe('Module: SettingsHoverProvider', async () => {
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
        hover: {},
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
      it(`provide hover for ${test.label} setting when setting label contains a translation key`, async () => {
        const schema = {
          settings: [
            { id: 'custom-setting', label: 'Custom Setting' },
            { id: 'fake-setting', label: 't:general.fake' },
          ],
          ...test.schemaTemplate({
            settings: {
              'fake-setting█': '',
            },
          }),
        };
        const source = `
          {% schema %}
            ${JSON.stringify(schema)}
          {% endschema %}
        `;
        const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
        const hover = await jsonLanguageService.hover(params);

        expect(hover).not.toBeNull();
        expect(hover!.contents).to.have.lengthOf(1);
        expect(hover!.contents).toEqual(['Fake Setting']);
      });

      it(`provide hover for ${test.label} setting when setting label is literal text`, async () => {
        const schema = {
          settings: [
            { id: 'custom-setting', label: 'Custom Setting' },
            { id: 'fake-setting', label: 't:general.fake' },
          ],
          ...test.schemaTemplate({
            settings: {
              'custom-setting█': '',
            },
          }),
        };
        const source = `
          {% schema %}
            ${JSON.stringify(schema)}
          {% endschema %}
        `;
        const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
        const hover = await jsonLanguageService.hover(params);

        expect(hover).not.toBeNull();
        expect(hover!.contents).to.have.lengthOf(1);
        expect(hover!.contents).toEqual(['Custom Setting']);
      });

      it(`provide no hover for ${test.label} setting when setting label does not exist`, async () => {
        const schema = {
          settings: [{ id: 'custom-setting' }, { id: 'fake-setting', label: 't:general.fake' }],
          ...test.schemaTemplate({
            settings: {
              'custom-setting█': '',
            },
          }),
        };
        const source = `
          {% schema %}
            ${JSON.stringify(schema)}
          {% endschema %}
        `;
        const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
        const hover = await jsonLanguageService.hover(params);

        expect(hover).not.toBeNull();
        expect(hover!.contents).to.have.lengthOf(0);
      });
    });
  }
});
