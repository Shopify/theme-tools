import { assert, beforeEach, describe, expect, it } from 'vitest';
import { Position, TextDocumentEdit } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';
import { RenameProvider } from '../RenameProvider';

describe('HtmlTagNameRenameProvider', () => {
  let documentManager: DocumentManager;
  let provider: RenameProvider;

  beforeEach(() => {
    documentManager = new DocumentManager();
    provider = new RenameProvider(documentManager);
  });

  it('returns null when the cursor is not over an HTML tag name', async () => {
    const params = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0),
      newName: 'new-name',
    };
    documentManager.open(params.textDocument.uri, 'all text', 1);
    const result = await provider.rename(params);
    expect(result).to.be.null;
  });

  it('returns the correct workspace edit when renaming an HTML tag name', async () => {
    const params = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 2),
      newName: 'new-name',
    };
    documentManager.open(params.textDocument.uri, '<old><old></old></old>', 1);
    const result = await provider.rename(params);
    assert(result);
    assert(result.documentChanges);
    expect(result.documentChanges).to.have.lengthOf(1);
    assert(result.documentChanges[0]);
    assert(TextDocumentEdit.is(result.documentChanges[0]));
    expect(result.documentChanges[0]!.edits).to.have.lengthOf(2);
    expect(result.documentChanges[0]!.edits[0].newText).to.equal('new-name');
    expect(result.documentChanges[0]!.edits[1].newText).to.equal('new-name');
    const doc = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(doc);

    // Now we apply the edits on the document to make sure the file after the edit
    // is what we expect it to be
    const textEdits = result.documentChanges[0]!.edits;
    expect(textEdits).to.applyEdits(doc, '<new-name><old></old></new-name>');
  });

  it('also works on complext liquid + text html tag names', async () => {
    const params = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 2),
      newName: 'new-name',
    };
    documentManager.open(params.textDocument.uri, '<web--{{ comp }}>text</web--{{ comp }}>', 1);
    const result = await provider.rename(params);
    assert(result);
    assert(result.documentChanges);
    expect(result.documentChanges).to.have.lengthOf(1);
    assert(result.documentChanges[0]);
    assert(TextDocumentEdit.is(result.documentChanges[0]));
    expect(result.documentChanges[0]!.edits).to.have.lengthOf(2);
    expect(result.documentChanges[0]!.edits[0].newText).to.equal('new-name');
    expect(result.documentChanges[0]!.edits[1].newText).to.equal('new-name');
    const doc = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(doc);

    // Now we apply the edits on the document to make sure the file after the edit
    // is what we expect it to be
    const textEdits = result.documentChanges[0]!.edits;
    expect(textEdits).to.applyEdits(doc, '<new-name>text</new-name>');
  });
});
