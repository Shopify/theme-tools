import { describe, beforeEach, it, expect, assert } from 'vitest';
import { LinkedEditingRangesProvider } from '..';
import { DocumentManager } from '../../documents';
import { LinkedEditingRangeParams } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-protocol';
import { htmlElementNameWordPattern } from '../wordPattern';

describe('Module: EmptyHtmlTagLinkedRangesProvider', () => {
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

  it('should return null for non-empty HTML tags', async () => {
    const params: LinkedEditingRangeParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0),
    };

    documentManager.open(params.textDocument.uri, '<div></div>', 1);

    const result = await provider.linkedEditingRanges(params);
    expect(result).toBeNull();
  });

  it('should return linked editing ranges for empty HTML tags', async () => {
    const params: LinkedEditingRangeParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 1), // position within the empty tag
    };

    documentManager.open(params.textDocument.uri, '<></>', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.linkedEditingRanges(params);
    assert(result);
    assert(result.ranges[0]);
    assert(result.ranges[1]);
    expect(result.ranges[0]).not.to.eql(result.ranges[1]);

    const startTag = document.getText(result.ranges[0]);
    const endTag = document.getText(result.ranges[1]);

    expect(startTag).toBe('');
    expect(endTag).toBe('');
    expect(result.wordPattern).toBe(htmlElementNameWordPattern);
  });

  it('should return null for positions not within empty HTML tags', async () => {
    const params: LinkedEditingRangeParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0), // position outside the tag
    };

    documentManager.open(params.textDocument.uri, '<></>', 1);

    const result = await provider.linkedEditingRanges(params);
    expect(result).toBeNull();
  });
});
