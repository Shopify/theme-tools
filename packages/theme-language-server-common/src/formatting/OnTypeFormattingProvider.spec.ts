import { describe, beforeEach, it, expect, assert } from 'vitest';
import { OnTypeFormattingProvider } from './OnTypeFormattingProvider';
import { DocumentManager } from '../documents';
import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { Position, TextEdit, Range } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

const options: DocumentOnTypeFormattingParams['options'] = {
  insertSpaces: true,
  tabSize: 2,
};

describe('Module: OnTypeFormattingProvider', () => {
  let documentManager: DocumentManager;
  let onTypeFormattingProvider: OnTypeFormattingProvider;

  beforeEach(() => {
    documentManager = new DocumentManager();
    onTypeFormattingProvider = new OnTypeFormattingProvider(documentManager);
  });

  it('should return null for non-existent documents', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/non-existent-document.liquid' },
      position: Position.create(0, 0),
      ch: ' ',
      options,
    };

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    expect(result).toBeNull();
  });

  it('should return null if character is space and cursor position is less than or equal to 2', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 1),
      ch: ' ',
      options,
    };

    documentManager.open(params.textDocument.uri, 'Sample text content', 1);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    expect(result).toBeNull();
  });

  it('should return null if character is not space and cursor position is less than or equal to 1', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0),
      ch: 'a',
      options,
    };

    documentManager.open(params.textDocument.uri, 'Sample text content', 1);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    expect(result).toBeNull();
  });

  it('should return a TextEdit to insert a space after "{{" in "{{ }}"', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 2),
      ch: '{',
      options,
    };

    documentManager.open(params.textDocument.uri, '{{ }}', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    assert(result);
    expect(TextDocument.applyEdits(document, result)).to.equal('{{  }}');
  });

  it('should return a TextEdit to insert a space after "{%" in "{% %}"', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 2),
      ch: '%',
      options,
    };

    documentManager.open(params.textDocument.uri, '{% %}', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    assert(result);
    expect(TextDocument.applyEdits(document, result)).to.equal('{%  %}');
  });

  it('should return a TextEdit to replace and insert characters in "{{ - }}"', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 4),
      ch: '-',
      options,
    };

    documentManager.open(params.textDocument.uri, '{{ - }}', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    assert(result);
    expect(TextDocument.applyEdits(document, result)).to.equal('{{-  -}}');
  });

  it('should return a TextEdit to replace and insert characters in "{% - %}"', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 4),
      ch: '-',
      options,
    };

    documentManager.open(params.textDocument.uri, '{% - %}', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    assert(result);
    expect(TextDocument.applyEdits(document, result)).to.equal('{%-  -%}');
  });

  it('should return null for characters not matching any case', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 3),
      ch: 'a',
      options,
    };

    documentManager.open(params.textDocument.uri, 'Sample text content', 1);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    expect(result).toBeNull();
  });
});
