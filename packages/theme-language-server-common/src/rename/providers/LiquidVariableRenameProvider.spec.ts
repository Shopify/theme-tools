import { assert, beforeEach, describe, expect, it } from 'vitest';
import { Position, TextDocumentEdit } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';
import { RenameProvider } from '../RenameProvider';

describe('HtmlTagNameRenameProvider', () => {
  let documentManager: DocumentManager;
  let provider: RenameProvider;

  const textDocument = { uri: 'file:///path/to/document.liquid' };
  const documentSource = `{% assign animal = 'dog' %}
{% assign plant = 'cactus' %}
{% liquid
  echo plant
%}
{% assign painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal and a great plant</p>`;

  beforeEach(() => {
    documentManager = new DocumentManager();
    provider = new RenameProvider(documentManager);

    documentManager.open(textDocument.uri, documentSource, 1);
  });

  it('returns null when the cursor is not over a liquid variable', async () => {
    const params = {
      textDocument,
      position: Position.create(0, 3),
      newName: 'pet',
    };

    const result = await provider.rename(params);
    expect(result).to.be.null;
  });

  it('returns new name after liquid variable is renamed from assign tag', async () => {
    const params = {
      textDocument,
      position: Position.create(0, 11),
      newName: 'pet',
    };

    const result = await provider.rename(params);
    assert(result);
    assert(result.documentChanges);
    expect(result.documentChanges).to.have.lengthOf(1);
    assert(result.documentChanges[0]);
    assert(TextDocumentEdit.is(result.documentChanges[0]));

    // Should not try to rename the variable in HTML
    expect(result.documentChanges[0]!.edits).to.have.lengthOf(1);
    expect(result.documentChanges[0]!.edits[0].newText).to.equal('pet');

    const range = result.documentChanges[0]!.edits[0].range;
    expect(range.start).to.deep.equal({
      line: 0,
      character: 10,
    });
    expect(range.end).to.deep.equal({
      line: 0,
      character: 16,
    });
  });

  it('returns new name after liquid variable is renamed on variable usage', async () => {
    const params = {
      textDocument,
      position: Position.create(3, 11),
      newName: 'fauna',
    };

    const result = await provider.rename(params);
    assert(result);
    assert(result.documentChanges);
    expect(result.documentChanges).to.have.lengthOf(1);
    assert(result.documentChanges[0]);
    assert(TextDocumentEdit.is(result.documentChanges[0]));

    // Should not try to rename the variable in HTML
    expect(result.documentChanges[0]!.edits).to.have.lengthOf(2);
    expect(result.documentChanges[0]!.edits[0].newText).to.equal('fauna');
    expect(result.documentChanges[0]!.edits[1].newText).to.equal('fauna');

    const range1 = result.documentChanges[0]!.edits[0].range;
    expect(range1.start).to.deep.equal({
      line: 1,
      character: 10,
    });
    expect(range1.end).to.deep.equal({
      line: 1,
      character: 15,
    });

    const range2 = result.documentChanges[0]!.edits[1].range;
    expect(range2.start).to.deep.equal({
      line: 3,
      character: 7,
    });
    expect(range2.end).to.deep.equal({
      line: 3,
      character: 12,
    });
  });

  it("doesn't rename variables where the name of the one being changed contains within it", async () => {
    const params = {
      textDocument,
      position: Position.create(5, 11),
      newName: 'famous_painting',
    };

    const result = await provider.rename(params);
    assert(result);
    assert(result.documentChanges);
    expect(result.documentChanges).to.have.lengthOf(1);
    assert(result.documentChanges[0]);
    assert(TextDocumentEdit.is(result.documentChanges[0]));

    // Should not try to rename "paintings" variable
    expect(result.documentChanges[0]!.edits).to.have.lengthOf(1);
    expect(result.documentChanges[0]!.edits[0].newText).to.equal('famous_painting');

    const range = result.documentChanges[0]!.edits[0].range;
    expect(range.start).to.deep.equal({
      line: 5,
      character: 10,
    });
    expect(range.end).to.deep.equal({
      line: 5,
      character: 18,
    });
  });
});
