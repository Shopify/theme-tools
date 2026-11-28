import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { OnTypeFormattingProvider } from '../OnTypeFormattingProvider';

const options: DocumentOnTypeFormattingParams['options'] = {
  insertSpaces: true,
  tabSize: 2,
};

describe('Module: AngleBracketAutoclosingOnTypeFormattingProvider', () => {
  let documentManager: DocumentManager;
  let onTypeFormattingProvider: OnTypeFormattingProvider;
  const uri = 'file:///path/to/document.liquid';

  beforeEach(() => {
    documentManager = new DocumentManager();
    onTypeFormattingProvider = new OnTypeFormattingProvider(documentManager);
  });

  it('should insert a closing angle bracket outside Liquid markup', async () => {
    const source = '<';
    documentManager.open(uri, source, 1);
    const document = documentManager.get(uri)?.textDocument;
    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting({
      textDocument: { uri },
      position: document.positionAt(1),
      ch: '<',
      options,
    });

    assert(result);
    expect(result).to.applyEdits(document, '<>');
  });

  it('should not insert a closing angle bracket in a Liquid tag', async () => {
    const sources = ['{% if 2 < %}', '{% liquid\n  if 2 <\n\n  endif\n%}'];

    for (const source of sources) {
      documentManager.open(uri, source, 1);
      const document = documentManager.get(uri)?.textDocument;
      assert(document);

      const result = await onTypeFormattingProvider.onTypeFormatting({
        textDocument: { uri },
        position: document.positionAt(source.indexOf('<') + 1),
        ch: '<',
        options,
      });

      expect(result, source).toBeNull();
    }
  });

  it('should still insert a closing angle bracket in HTML nested in a Liquid block', async () => {
    const source = '{% if true %}<{% endif %}';
    documentManager.open(uri, source, 1);
    const document = documentManager.get(uri)?.textDocument;
    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting({
      textDocument: { uri },
      position: document.positionAt(source.indexOf('<') + 1),
      ch: '<',
      options,
    });

    assert(result);
    expect(result).to.applyEdits(document, '{% if true %}<>{% endif %}');
  });
});
