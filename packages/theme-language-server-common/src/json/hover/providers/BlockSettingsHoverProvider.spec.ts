import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../../documents';
import { JSONLanguageService } from '../../JSONLanguageService';
import { getRequestParams, mockJSONLanguageService } from '../../test/test-helpers';

describe('Module: BlockSettingsHoverProvider', async () => {
  const rootUri = 'file:///root';
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

  const testBlockName = 'test-block';

  describe('valid theme block settings', async () => {
    beforeEach(() => {
      const testBlockSchema = {
        settings: [
          { id: 'custom-setting', label: 'Custom Setting' },
          { id: 'fake-setting', label: 't:general.fake' },
        ],
      };
      documentManager.open(
        `${rootUri}/blocks/${testBlockName}.liquid`,
        toSource(testBlockSchema),
        1,
      );
    });

    it('provides hover when referenced block has literal settings label', async () => {
      const testSectionSchema = {
        presets: [
          {
            blocks: {
              [testBlockName]: {
                type: testBlockName,
                settings: {
                  'custom-setting█': '',
                },
              },
            },
          },
        ],
      };
      const params = getRequestParams(
        documentManager,
        'sections/test-section.liquid',
        toSource(testSectionSchema),
      );
      const hover = await jsonLanguageService.hover(params);
      expect(hover).not.toBeNull();
      expect(hover!.contents).to.have.lengthOf(1);
      expect(hover!.contents).toEqual(['Custom Setting']);
    });

    it('provides hover when referenced block has translation settings label', async () => {
      const testSectionSchema = {
        presets: [
          {
            blocks: {
              [testBlockName]: {
                type: testBlockName,
                settings: {
                  'fake-setting█': '',
                },
              },
            },
          },
        ],
      };
      const params = getRequestParams(
        documentManager,
        'sections/test-section.liquid',
        toSource(testSectionSchema),
      );
      const hover = await jsonLanguageService.hover(params);
      expect(hover).not.toBeNull();
      expect(hover!.contents).to.have.lengthOf(1);
      expect(hover!.contents).toEqual(['Fake Setting']);
    });

    it('provides hover when block reference is nested within another referenced block', async () => {
      const testSectionSchema = {
        presets: [
          {
            blocks: [
              {
                type: 'fake-block',
                blocks: {
                  [testBlockName]: {
                    type: testBlockName,
                    settings: {
                      'fake-setting█': '',
                    },
                  },
                },
              },
            ],
          },
        ],
      };
      const params = getRequestParams(
        documentManager,
        'sections/test-section.liquid',
        toSource(testSectionSchema),
      );
      const hover = await jsonLanguageService.hover(params);
      expect(hover).not.toBeNull();
      expect(hover!.contents).to.have.lengthOf(1);
      expect(hover!.contents).toEqual(['Fake Setting']);
    });
  });

  describe('valid section block settings', async () => {
    function hoverParams(settingId: string) {
      const testSectionSchema = {
        blocks: [
          {
            type: testBlockName,
            name: 'Test Block',
            settings: [
              { id: 'custom-setting', label: 'Custom Setting' },
              { id: 'fake-setting', label: 't:general.fake' },
            ],
          },
        ],
        presets: [
          {
            blocks: {
              [testBlockName]: {
                type: testBlockName,
                settings: {
                  [`${settingId}█`]: '',
                },
              },
            },
          },
        ],
      };
      return getRequestParams(
        documentManager,
        'sections/test-section.liquid',
        toSource(testSectionSchema),
      );
    }

    it('provides hover when referenced block has literal settings label', async () => {
      const params = hoverParams('custom-setting');
      const hover = await jsonLanguageService.hover(params);
      expect(hover).not.toBeNull();
      expect(hover!.contents).to.have.lengthOf(1);
      expect(hover!.contents).toEqual(['Custom Setting']);
    });

    it('provides hover when referenced block has translation settings label', async () => {
      const params = hoverParams('fake-setting');
      const hover = await jsonLanguageService.hover(params);
      expect(hover).not.toBeNull();
      expect(hover!.contents).to.have.lengthOf(1);
      expect(hover!.contents).toEqual(['Fake Setting']);
    });
  });

  describe('invalid theme block settings', async () => {
    it('provides no hover when block file nor local block exist', async () => {
      const testSectionSchema = {
        presets: [
          {
            blocks: {
              [testBlockName]: {
                type: testBlockName,
                settings: {
                  'nonexistent-setting█': '',
                },
              },
            },
          },
        ],
      };
      const params = getRequestParams(
        documentManager,
        'sections/test-section.liquid',
        toSource(testSectionSchema),
      );
      const hover = await jsonLanguageService.hover(params);
      expect(hover).not.toBeNull();
      expect(hover!.contents).to.have.lengthOf(0);
    });

    it('provides no hover when block file has no settings', async () => {
      const testBlockSchema = {};
      documentManager.open(
        `${rootUri}/blocks/${testBlockName}.liquid`,
        toSource(testBlockSchema),
        1,
      );

      const testSectionSchema = {
        presets: [
          {
            blocks: {
              [testBlockName]: {
                type: testBlockName,
                settings: {
                  'nonexistent-setting█': '',
                },
              },
            },
          },
        ],
      };
      const params = getRequestParams(
        documentManager,
        'sections/test-section.liquid',
        toSource(testSectionSchema),
      );
      const hover = await jsonLanguageService.hover(params);
      expect(hover).not.toBeNull();
      expect(hover!.contents).to.have.lengthOf(0);
    });

    it('provides no hover when local block has no settings', async () => {
      const testSectionSchema = {
        blocks: [
          {
            type: testBlockName,
            name: 'Test Block',
          },
        ],
        presets: [
          {
            blocks: {
              [testBlockName]: {
                type: testBlockName,
                settings: {
                  'nonexistent-setting█': '',
                },
              },
            },
          },
        ],
      };
      const params = getRequestParams(
        documentManager,
        'sections/test-section.liquid',
        toSource(testSectionSchema),
      );
      const hover = await jsonLanguageService.hover(params);
      expect(hover).not.toBeNull();
      expect(hover!.contents).to.have.lengthOf(0);
    });
  });
});

function toSource(schema: object) {
  return `{% schema %}
  ${JSON.stringify(schema)}
{% endschema %}`;
}
