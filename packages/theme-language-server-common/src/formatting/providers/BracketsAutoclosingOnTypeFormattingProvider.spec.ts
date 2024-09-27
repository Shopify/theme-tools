import { assert, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../documents';
import { OnTypeFormattingProvider } from '../OnTypeFormattingProvider';

const options: DocumentOnTypeFormattingParams['options'] = {
  insertSpaces: true,
  tabSize: 2,
};

describe('Module: BracketsAutoclosingOnTypeFormattingProvider', () => {
  let documentManager: DocumentManager;
  let onTypeFormattingProvider: OnTypeFormattingProvider;

  beforeEach(() => {
    documentManager = new DocumentManager();
    onTypeFormattingProvider = new OnTypeFormattingProvider(documentManager);
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
});
