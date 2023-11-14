import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DocumentHighlightParams } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-protocol';
import { DocumentHighlightsProvider } from '..';
import { DocumentManager } from '../../documents';

describe('Module: HtmlTagNameDocumentHighlightsProvider', () => {
  let documentManager: DocumentManager;
  let provider: DocumentHighlightsProvider;

  beforeEach(() => {
    documentManager = new DocumentManager();
    provider = new DocumentHighlightsProvider(documentManager);
  });

  it('should return null for non-existent documents', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/non-existent-document.liquid' },
      position: Position.create(0, 0),
    };

    const result = await provider.documentHighlights(params);
    expect(result).toBeNull();
  });

  it('should return null for non-HTML documents', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0),
    };

    documentManager.open(params.textDocument.uri, 'Sample text content', 1);

    const result = await provider.documentHighlights(params);
    expect(result).toBeNull();
  });

  it('should return document highlight ranges for HTML tag names', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 3), // position within the tag name
    };

    documentManager.open(params.textDocument.uri, '<div></div>', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.documentHighlights(params);
    assert(result);
    assert(result[0]);
    assert(result[1]);
    expect(result[0]).not.to.eql(result[1]);

    const startTagName = document.getText(result[0].range);
    const endTagName = document.getText(result[1].range);

    expect(startTagName).toBe('div');
    expect(endTagName).toBe('div');
  });

  it('should return document highlight ranges for closing HTML tag names', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 16), // position within the closing div tag name
    };

    documentManager.open(params.textDocument.uri, '<div><img><div></div></div>', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.documentHighlights(params);
    assert(result);
    assert(result[0]);
    assert(result[1]);

    const startTagName = document.getText(result[0].range);
    const endTagName = document.getText(result[1].range);

    expect(startTagName).toBe('div');
    expect(endTagName).toBe('div');
  });

  it('should return null for positions not within HTML tag names', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0), // position outside the tag name
    };

    documentManager.open(params.textDocument.uri, '<div></div>', 1);

    const result = await provider.documentHighlights(params);
    expect(result).toBeNull();
  });
});
