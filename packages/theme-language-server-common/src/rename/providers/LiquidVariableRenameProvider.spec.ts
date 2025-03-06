import { assert, beforeEach, describe, expect, it } from 'vitest';
import { Position, TextDocumentEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../documents';
import { RenameProvider } from '../RenameProvider';
import { mockConnection, MockConnection } from '../../test/MockConnection';
import { ClientCapabilities } from '../../ClientCapabilities';

const mockRoot = 'file:';

describe('LiquidVariableRenameProvider', () => {
  const textDocumentUri = `${mockRoot}///snippets/example-snippet.liquid`;
  const findThemeRootURI = async () => mockRoot;

  let capabilities: ClientCapabilities;
  let connection: MockConnection;

  beforeEach(() => {
    capabilities = new ClientCapabilities();
    connection = mockConnection(mockRoot);
    connection.spies.sendRequest.mockReturnValue(Promise.resolve(true));
  });

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
      provider = new RenameProvider(connection, capabilities, documentManager, findThemeRootURI);

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
      provider = new RenameProvider(connection, capabilities, documentManager, findThemeRootURI);
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

  describe('updates across files', async () => {
    let documentManager: DocumentManager;
    let provider: RenameProvider;
    let textDocument: TextDocument;

    beforeEach(() => {
      capabilities.setup({
        workspace: {
          applyEdit: true,
        },
      });
      textDocument = TextDocument.create(
        textDocumentUri,
        'liquid',
        1,
        `{% doc %}
  @param [name] - the name
  @param [age] - the age
{% enddoc %}`,
      );

      documentManager = new DocumentManager();
      provider = new RenameProvider(connection, capabilities, documentManager, findThemeRootURI);

      documentManager.open(textDocumentUri, textDocument.getText(), 1);
    });

    it("updates render tag's named parameter when exists", async () => {
      createSectionWithSource(
        documentManager,
        'section1',
        `<div>{% render 'example-snippet', name: 'Bob' %}</div>`,
      );
      createSectionWithSource(
        documentManager,
        'section2',
        `<div>{% render 'example-snippet', age: 60 %}</div>`,
      );

      const params = {
        textDocument,
        position: Position.create(1, 11),
        newName: 'first_name',
      };
      const result = await provider.rename(params);
      assert(result);
      assert(result.documentChanges);

      expect(connection.spies.sendRequest).toHaveBeenCalledOnce();
      expect(connection.spies.sendRequest).toHaveBeenCalledWith('workspace/applyEdit', {
        label: `Rename snippet parameter 'name' to 'first_name'`,
        edit: {
          changeAnnotations: {
            renameSnippetParameter: {
              label: `Rename snippet parameter 'name' to 'first_name'`,
              needsConfirmation: false,
            },
          },
          documentChanges: [
            {
              textDocument: {
                uri: getSectionUri('section1'),
                version: 1,
              },
              edits: [
                {
                  newText: 'first_name: ',
                  range: {
                    end: {
                      character: 40,
                      line: 0,
                    },
                    start: {
                      character: 34,
                      line: 0,
                    },
                  },
                },
              ],
              annotationId: 'renameSnippetParameter',
            },
          ],
        },
      });
    });
  });
});

function createSectionWithSource(
  documentManager: DocumentManager,
  sectionName: string,
  source: string,
) {
  const sectionUri = getSectionUri(sectionName);
  const sectionTextDocument = TextDocument.create(sectionUri, 'liquid', 1, source);
  documentManager.open(sectionUri, sectionTextDocument.getText(), 1);
}

function getSectionUri(sectionName: string) {
  return `${mockRoot}///sections/${sectionName}.liquid`;
}
