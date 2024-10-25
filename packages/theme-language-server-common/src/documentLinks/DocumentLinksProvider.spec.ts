import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../documents';
import { DocumentLinksProvider } from './DocumentLinksProvider';

describe('DocumentLinksProvider', () => {
  let documentManager: DocumentManager;
  let documentLinksProvider: DocumentLinksProvider;

  beforeEach(() => {
    documentManager = new DocumentManager();
    documentLinksProvider = new DocumentLinksProvider(documentManager);
  });

  it('should return an empty array for non-LiquidHtml documents', async () => {
    const uriString = 'file:///path/to/non-liquid-html-document.txt';
    const rootUri = 'file:///path/to/project';

    documentManager.open(uriString, 'Sample plain text content', 1);

    const result = await documentLinksProvider.documentLinks(uriString, rootUri);
    expect(result).toEqual([]);
  });

  it('should return an empty array for non-existent documents', async () => {
    const uriString = 'file:///path/to/non-existent-document.txt';
    const rootUri = 'file:///path/to/project';

    const result = await documentLinksProvider.documentLinks(uriString, rootUri);
    expect(result).toEqual([]);
  });

  it('should return a list of document links with correct URLs for a LiquidHtml document', async () => {
    const uriString = 'file:///path/to/liquid-html-document.liquid';
    const rootUri = 'file:///path/to/project';

    const liquidHtmlContent = `
      {% render 'snippet1' %}
      {% include 'snippet2' %}
      {% section 'header' %}
      {% echo 'echo.js' | asset_url %}
      {% assign x = 'assign.css' | asset_url %}
      {{ 'asset.js' | asset_url }}
    `;

    documentManager.open(uriString, liquidHtmlContent, 1);

    const result = await documentLinksProvider.documentLinks(uriString, rootUri);
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
});
