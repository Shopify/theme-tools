import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../../documents';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { JSONHoverProvider } from '../JSONHoverProvider';
import { PresetsSettingsHoverProvider } from './PresetsSettingsHoverProvider';
import { JSONLanguageService } from '../../JSONLanguageService';
import { getRequestParams, mockJSONLanguageService } from '../../test/test-helpers';

describe('Module: PresetsSettingsHoverProvider', async () => {
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

  it('provide hover for preset setting when setting label contains a translation key', async () => {
    const source = `
      {% schema %}
      {
        "settings": [
          {"id": "custom-setting", "label": "Custom Setting"},
          {"id": "fake-setting", "label": "t:general.fake"},
        ],
        "presets": [{
          "settings": {
            "fake-setting█": "",
          }
        }]
      }
      {% endschema %}
    `;
    const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
    const hover = await jsonLanguageService.hover(params);

    expect(hover).not.toBeNull();
    expect(hover!.contents).to.have.lengthOf(1);
    expect(hover!.contents).toEqual(['Fake Setting']);
  });

  it('provide hover for preset setting when setting label is literal text', async () => {
    const source = `
      {% schema %}
      {
        "settings": [
          {"id": "custom-setting", "label": "Custom Setting"},
          {"id": "fake-setting", "label": "t:general.fake"},
        ],
        "presets": [{
          "settings": {
            "custom-setting█": "",
          }
        }]
      }
      {% endschema %}
    `;
    const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
    const hover = await jsonLanguageService.hover(params);

    expect(hover).not.toBeNull();
    expect(hover!.contents).to.have.lengthOf(1);
    expect(hover!.contents).toEqual(['Custom Setting']);
  });

  it('provide no hover for preset setting when setting label does not exist', async () => {
    const source = `
      {% schema %}
      {
        "settings": [
          {"id": "custom-setting"},
          {"id": "fake-setting", "label": "t:general.fake"},
        ],
        "presets": [{
          "settings": {
            "custom-setting█": "",
          }
        }]
      }
      {% endschema %}
    `;
    const params = getRequestParams(documentManager, 'blocks/block.liquid', source);
    const hover = await jsonLanguageService.hover(params);

    expect(hover).not.toBeNull();
    expect(hover!.contents).to.have.lengthOf(0);
  });
});
