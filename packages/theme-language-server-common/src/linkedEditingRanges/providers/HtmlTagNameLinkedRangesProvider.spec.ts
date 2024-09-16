import { describe, beforeEach, it, expect, assert } from 'vitest';
import { LinkedEditingRangesProvider } from '../LinkedEditingRangesProvider';
import { DocumentManager } from '../../documents';
import { LinkedEditingRangeParams } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-protocol';
import { htmlElementNameWordPattern } from '../wordPattern';

describe('Module: HtmlTagNameLinkedRangesProvider', () => {
  let documentManager: DocumentManager;
  let provider: LinkedEditingRangesProvider;

  beforeEach(() => {
    documentManager = new DocumentManager();
    provider = new LinkedEditingRangesProvider(documentManager);
  });

  it('should return null for non-existent documents', async () => {
    const params: LinkedEditingRangeParams = {
      textDocument: { uri: 'file:///path/to/non-existent-document.liquid' },
      position: Position.create(0, 0),
    };

    const result = await provider.linkedEditingRanges(params);
    expect(result).toBeNull();
  });

  it('should return null for non-HTML documents', async () => {
    const params: LinkedEditingRangeParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0),
    };

    documentManager.open(params.textDocument.uri, 'Sample text content', 1);

    const result = await provider.linkedEditingRanges(params);
    expect(result).toBeNull();
  });

  it('should return linked editing ranges for HTML tag names', async () => {
    const params: LinkedEditingRangeParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 3), // position within the tag name
    };

    documentManager.open(params.textDocument.uri, '<div></div>', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.linkedEditingRanges(params);
    assert(result);
    assert(result.ranges[0]);
    assert(result.ranges[1]);
    expect(result.ranges[0]).not.to.eql(result.ranges[1]);

    const startTagName = document.getText(result.ranges[0]);
    const endTagName = document.getText(result.ranges[1]);

    expect(startTagName).toBe('div');
    expect(endTagName).toBe('div');
    expect(result.wordPattern).toBe(htmlElementNameWordPattern);
  });

  it('should return linked editing ranges for closing HTML tag names', async () => {
    const params: LinkedEditingRangeParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 16), // position within the closing div tag name
    };

    documentManager.open(params.textDocument.uri, '<div><img><div></div></div>', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.linkedEditingRanges(params);
    assert(result);
    assert(result.ranges[0]);
    assert(result.ranges[1]);

    const startTagName = document.getText(result.ranges[0]);
    const endTagName = document.getText(result.ranges[1]);

    expect(startTagName).toBe('div');
    expect(endTagName).toBe('div');
    expect(result.wordPattern).toBe(htmlElementNameWordPattern);
  });

  it('should return null for positions not within HTML tag names', async () => {
    const params: LinkedEditingRangeParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0), // position outside the tag name
    };

    documentManager.open(params.textDocument.uri, '<div></div>', 1);

    const result = await provider.linkedEditingRanges(params);
    expect(result).toBeNull();
  });
});
