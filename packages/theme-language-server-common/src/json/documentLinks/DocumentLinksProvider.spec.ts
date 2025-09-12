import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../../documents';
import { JsonDocumentLinksProvider } from './DocumentLinksProvider';

describe('JsonDocumentLinksProvider', () => {
  let documentManager: DocumentManager;
  let jsonDocumentLinksProvider: JsonDocumentLinksProvider;
  let rootUri: string;
  let uriString: string;

  beforeEach(() => {
    documentManager = new DocumentManager();
    jsonDocumentLinksProvider = new JsonDocumentLinksProvider(documentManager, async () => rootUri);
  });

  it('should return an empty array for non-JSON documents', async () => {
    uriString = 'file:///path/to/non-json-document.liquid';
    rootUri = 'file:///path/to/project';

    documentManager.open(uriString, '<div>Not JSON</div>', 1);

    const result = await jsonDocumentLinksProvider.documentLinks(uriString);
    expect(result).toEqual([]);
  });

  it('should return an empty array for non-existent documents', async () => {
    uriString = 'file:///path/to/non-existent-document.json';
    rootUri = 'file:///path/to/project';

    const result = await jsonDocumentLinksProvider.documentLinks(uriString);
    expect(result).toEqual([]);
  });

  it('should return document links for template references', async () => {
    uriString = 'file:///path/to/templates/index.json';
    rootUri = 'file:///path/to/project';

    const jsonContent = `{
      "layout": "theme",
      "sections": {
        "header": {
          "type": "header-section"
        }
      }
    }`;

    documentManager.open(uriString, jsonContent, 1);

    const result = await jsonDocumentLinksProvider.documentLinks(uriString);
    const expectedUrls = ['file:///path/to/project/sections/header-section.liquid'];

    expect(result.length).toBe(expectedUrls.length);
    for (let i = 0; i < expectedUrls.length; i++) {
      expect(result[i].target).toBe(expectedUrls[i]);
    }
  });

  it('should return document links for block references in section schemas', async () => {
    uriString = 'file:///path/to/sections/settings.json';
    rootUri = 'file:///path/to/project';

    const jsonContent = `{
      "name": "Section with blocks",
      "blocks": [
        { "type": "text" },
        { "type": "image" },
        { "type": "@app" }
      ]
    }`;

    documentManager.open(uriString, jsonContent, 1);

    const result = await jsonDocumentLinksProvider.documentLinks(uriString);
    const expectedUrls = [
      'file:///path/to/project/blocks/text.liquid',
      'file:///path/to/project/blocks/image.liquid',
    ];

    expect(result.length).toBe(expectedUrls.length);
    for (let i = 0; i < expectedUrls.length; i++) {
      expect(result[i].target).toBe(expectedUrls[i]);
    }
  });

  it('should not create links for special block types', async () => {
    uriString = 'file:///path/to/sections/special.json';
    rootUri = 'file:///path/to/project';

    const jsonContent = `{
      "blocks": [
        { "type": "@app" },
        { "type": "@theme" }
      ]
    }`;

    documentManager.open(uriString, jsonContent, 1);

    const result = await jsonDocumentLinksProvider.documentLinks(uriString);
    expect(result).toEqual([]);
  });

  it('should handle nested structures correctly', async () => {
    uriString = 'file:///path/to/templates/complex.json';
    rootUri = 'file:///path/to/project';

    const jsonContent = `{
      "layout": "product",
      "sections": {
        "main": {
          "type": "product-template",
          "blocks": {
            "price": {
              "type": "product-price"
            }
          }
        }
      }
    }`;

    documentManager.open(uriString, jsonContent, 1);

    const result = await jsonDocumentLinksProvider.documentLinks(uriString);
    const expectedUrls = [
      'file:///path/to/project/sections/product-template.liquid',
      'file:///path/to/project/sections/product-price.liquid',
    ];

    expect(result.length).toBe(expectedUrls.length);
    for (let i = 0; i < expectedUrls.length; i++) {
      expect(result[i].target).toBe(expectedUrls[i]);
    }
  });
});
