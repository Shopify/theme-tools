import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../documents';
import { DocumentLinksProvider } from './DocumentLinksProvider';

describe('DocumentLinksProvider', () => {
  let documentManager: DocumentManager;
  let documentLinksProvider: DocumentLinksProvider;
  let rootUri: string;
  let uriString: string;

  beforeEach(() => {
    documentManager = new DocumentManager();
    documentLinksProvider = new DocumentLinksProvider(documentManager, async () => rootUri);
  });

  it('should return an empty array for non-LiquidHtml documents', async () => {
    uriString = 'file:///path/to/non-liquid-html-document.txt';
    rootUri = 'file:///path/to/project';

    documentManager.open(uriString, 'Sample plain text content', 1);

    const result = await documentLinksProvider.documentLinks(uriString);
    expect(result).toEqual([]);
  });

  it('should return an empty array for non-existent documents', async () => {
    uriString = 'file:///path/to/non-existent-document.txt';
    rootUri = 'file:///path/to/project';

    const result = await documentLinksProvider.documentLinks(uriString);
    expect(result).toEqual([]);
  });

  it('should return a list of document links with correct URLs for a LiquidHtml document', async () => {
    uriString = 'file:///path/to/liquid-html-document.liquid';
    rootUri = 'file:///path/to/project';

    const liquidHtmlContent = `
      {% render 'snippet1' %}
      {% include 'snippet2' %}
      {% section 'header' %}
      {% echo 'echo.js' | asset_url %}
      {% assign x = 'assign.css' | asset_url %}
      {{ 'asset.js' | asset_url }}
    `;

    documentManager.open(uriString, liquidHtmlContent, 1);

    const result = await documentLinksProvider.documentLinks(uriString);
    const expectedUrls = [
      'file:///path/to/project/snippets/snippet1.liquid',
      'file:///path/to/project/snippets/snippet2.liquid',
      'file:///path/to/project/sections/header.liquid',
      'file:///path/to/project/assets/echo.js',
      'file:///path/to/project/assets/assign.css',
      'file:///path/to/project/assets/asset.js',
    ];

    expect(result.length).toBe(expectedUrls.length);
    for (let i = 0; i < expectedUrls.length; i++) {
      expect(result[i].target).toBe(expectedUrls[i]);
    }
  });

  it('should return a list of document links for customizable theme block types', async () => {
    // @theme and @app are not included as these are general types used for block targeting
    // inline blocks are not included as there are no related block files to link to
    uriString = 'file:///path/to/liquid-raw-tag-document.liquid';
    rootUri = 'file:///path/to/project';

    const liquidRawTagContent = `
      {% schema %}
        { "blocks": [{ "type": "@theme" }, {"type": "top_level" }, {"type": "_private_block" }],
          "name": "Test section",
          "presets": [
            {
              "blocks": {
                "block-1": {
                  "name": "inline block",
                  "type": "inline_block"
                },
                "block-2": {
                  "type": "nested_block"
                }
             }
          }
        ]
        }
        {% endschema %}
    `;

    documentManager.open(uriString, liquidRawTagContent, 1);

    const result = await documentLinksProvider.documentLinks(uriString);
    const expectedUrls = [
      'file:///path/to/project/blocks/top_level.liquid',
      'file:///path/to/project/blocks/_private_block.liquid',
      'file:///path/to/project/blocks/nested_block.liquid',
    ];
    expect(result.length).toBe(expectedUrls.length);
    for (let i = 0; i < expectedUrls.length; i++) {
      expect(result[i].target).toBe(expectedUrls[i]);
    }
  });
});
