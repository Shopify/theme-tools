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

    const documentSource = `{% doc %}@param {string} food - favorite food{% enddoc %}
{% assign animal = 'dog' %}
{% assign plant = 'cactus' %}
{% liquid
  echo plant
  echo food
%}
{% assign painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal, a great plant, and my favorite food</p>`;

    beforeEach(() => {
      documentManager = new DocumentManager();
      provider = new RenameProvider(documentManager);

      textDocument = TextDocument.create(textDocumentUri, 'liquid', 1, documentSource);
      documentManager.open(textDocument.uri, documentSource, 1);
    });

    it('returns null when the cursor is not over a liquid variable', async () => {
      const params = {
        textDocument,
        position: Position.create(1, 3),
        newName: 'pet',
      };

      const result = await provider.rename(params);
      expect(result).to.be.null;
    });

    it('returns new name after liquid variable is renamed from assign tag', async () => {
      const params = {
        textDocument,
        position: Position.create(1, 11),
        newName: 'pet',
      };

      const result = await provider.rename(params);
      assert(result);
      assert(result.documentChanges);
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% doc %}@param {string} food - favorite food{% enddoc %}
{% assign pet = 'dog' %}
{% assign plant = 'cactus' %}
{% liquid
  echo plant
  echo food
%}
{% assign painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal, a great plant, and my favorite food</p>`,
      );
    });

    it('returns new name after liquid variable is renamed on variable usage', async () => {
      const params = {
        textDocument,
        position: Position.create(4, 11),
        newName: 'fauna',
      };

      const result = await provider.rename(params);
      assert(result);
      assert(result.documentChanges);
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% doc %}@param {string} food - favorite food{% enddoc %}
{% assign animal = 'dog' %}
{% assign fauna = 'cactus' %}
{% liquid
  echo fauna
  echo food
%}
{% assign painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal, a great plant, and my favorite food</p>`,
      );
    });

    it("doesn't rename variables where the name of the one being changed contains within it", async () => {
      const params = {
        textDocument,
        position: Position.create(7, 11),
        newName: 'famous_painting',
      };

      const result = await provider.rename(params);
      assert(result);
      assert(result.documentChanges);
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% doc %}@param {string} food - favorite food{% enddoc %}
{% assign animal = 'dog' %}
{% assign plant = 'cactus' %}
{% liquid
  echo plant
  echo food
%}
{% assign famous_painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal, a great plant, and my favorite food</p>`,
      );
    });

    it('returns new name after liquid doc param is renamed in doc', async () => {
      const params = {
        textDocument,
        position: Position.create(0, 26),
        newName: 'meal',
      };

      const result = await provider.rename(params);
      assert(result);
      assert(result.documentChanges);
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% doc %}@param {string} meal - favorite food{% enddoc %}
{% assign animal = 'dog' %}
{% assign plant = 'cactus' %}
{% liquid
  echo plant
  echo meal
%}
{% assign painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal, a great plant, and my favorite food</p>`,
      );
    });

    it('returns new name after liquid doc param is renamed on variable usage', async () => {
      const params = {
        textDocument,
        position: Position.create(5, 9),
        newName: 'meal',
      };

      const result = await provider.rename(params);
      assert(result);
      assert(result.documentChanges);
      expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
        textDocument,
        `{% doc %}@param {string} meal - favorite food{% enddoc %}
{% assign animal = 'dog' %}
{% assign plant = 'cactus' %}
{% liquid
  echo plant
  echo meal
%}
{% assign painting = 'mona lisa' %}
{% assign paintings = 'starry night, sunday afternoon, the scream' %}
<p>I have a cool animal, a great plant, and my favorite food</p>`,
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

    describe('assign tag', () => {
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

    describe('liquid doc param', () => {
      const documentSource = `{% doc %}@param prod - product{% enddoc %}
{% liquid
  for prod in products
    echo prod.title
  endfor
  echo prod
%}`;

      beforeEach(() => {
        textDocument = TextDocument.create(textDocumentUri, 'liquid', 1, documentSource);
        documentManager.open(textDocument.uri, documentSource, 1);
      });

      it('returns new name after variable is renamed outside loop', async () => {
        const params = {
          textDocument,
          position: Position.create(0, 17),
          newName: 'ppp',
        };
        const result = await provider.rename(params);
        assert(result);
        assert(result.documentChanges);
        expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
          textDocument,
          `{% doc %}@param ppp - product{% enddoc %}
{% liquid
  for prod in products
    echo prod.title
  endfor
  echo ppp
%}`,
        );
      });

      it('returns new name after variable is renamed inside loop, but is scoped outside it', async () => {
        const params = {
          textDocument,
          position: Position.create(3, 10),
          newName: 'ppp',
        };
        const result = await provider.rename(params);
        assert(result);
        assert(result.documentChanges);
        expect((result.documentChanges[0] as TextDocumentEdit).edits).to.applyEdits(
          textDocument,
          `{% doc %}@param prod - product{% enddoc %}
{% liquid
  for ppp in products
    echo ppp.title
  endfor
  echo prod
%}`,
        );
      });
    });
  });
});
