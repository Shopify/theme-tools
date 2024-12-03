import { assert, beforeEach, describe, expect, it } from 'vitest';
import { Position, TextDocumentEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../documents';
import { RenameProvider } from '../RenameProvider';

describe('LiquidVariableRenameProvider', () => {
  const textDocumentUri = 'file:///path/to/document.liquid';

  describe('unscoped variable', async () => {
    let documentManager: DocumentManager;
    let provider: RenameProvider;
    let textDocument: TextDocument;

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

      textDocument = TextDocument.create(textDocumentUri, 'liquid', 1, documentSource);
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
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% assign pet = 'dog' %}
{% assign plant = 'cactus' %}
{% liquid
  echo plant
%}
{% assign painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal and a great plant</p>`,
      );
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
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% assign animal = 'dog' %}
{% assign fauna = 'cactus' %}
{% liquid
  echo fauna
%}
{% assign painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal and a great plant</p>`,
      );
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
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% assign animal = 'dog' %}
{% assign plant = 'cactus' %}
{% liquid
  echo plant
%}
{% assign famous_painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal and a great plant</p>`,
      );
    });
  });

  describe('scoped variable', async () => {
    let documentManager: DocumentManager;
    let provider: RenameProvider;
    let textDocument: TextDocument;

    const documentSource = `{% assign counter = 0 %}
{% assign prod = 'some product' %}
{% liquid
  LOOP prod in products
    echo prod.title
    increment counter
  endLOOP
%}`;

    beforeEach(() => {
      documentManager = new DocumentManager();
      provider = new RenameProvider(documentManager);
    });

    ['for', 'tablerow'].forEach((tag) => {
      [
        { placement: 'at loop definition', position: Position.create(3, tag.length + 4) },
        { placement: 'at variable usage', position: Position.create(4, 10) },
      ].forEach(async ({ placement, position }) => {
        it(`returns new name after variable is renamed within "${tag}" block (${placement})`, async () => {
          const source = documentSource.replace(/LOOP/g, tag);

          textDocument = TextDocument.create(textDocumentUri, 'liquid', 1, source);
          documentManager.open(textDocument.uri, source, 1);

          const params = {
            textDocument,
            position,
            newName: 'item',
          };
          const result = await provider.rename(params);
          assert(result);
          assert(result.documentChanges);
          expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
            textDocument,
            `{% assign counter = 0 %}
{% assign prod = 'some product' %}
{% liquid
  ${tag} item in products
    echo item.title
    increment counter
  end${tag}
%}`,
          );
        });
      });
    });

    it('returns new name after variable is renamed outside loop', async () => {
      const source = documentSource.replace(/LOOP/g, 'for');

      textDocument = TextDocument.create(textDocumentUri, 'liquid', 1, source);
      documentManager.open(textDocument.uri, source, 1);

      const params = {
        textDocument,
        position: Position.create(1, 11),
        newName: 'item',
      };
      const result = await provider.rename(params);
      assert(result);
      assert(result.documentChanges);
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% assign counter = 0 %}
{% assign item = 'some product' %}
{% liquid
  for prod in products
    echo prod.title
    increment counter
  endfor
%}`,
      );
    });

    it('returns new name after variable is renamed inside loop, but is scoped outside it', async () => {
      const source = documentSource.replace(/LOOP/g, 'for');

      textDocument = TextDocument.create(textDocumentUri, 'liquid', 1, source);
      documentManager.open(textDocument.uri, source, 1);

      const params = {
        textDocument,
        position: Position.create(0, 11),
        newName: 'x',
      };
      const result = await provider.rename(params);
      assert(result);
      assert(result.documentChanges);
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% assign x = 0 %}
{% assign prod = 'some product' %}
{% liquid
  for prod in products
    echo prod.title
    increment x
  endfor
%}`,
      );
    });
  });
});
