import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { TextDocumentEdit } from 'vscode-json-languageservice';
import { ApplyWorkspaceEditParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DocumentManager } from '../../documents';
import { MockConnection, mockConnection } from '../../test/MockConnection';
import { RenameHandler } from '../RenameHandler';

describe('Module: BlockRenameHandler', () => {
  const mockRoot = 'mock-fs:';
  const findThemeRootURI = async () => mockRoot;
  let capabilities: ClientCapabilities;
  let documentManager: DocumentManager;
  let handler: RenameHandler;
  let connection: MockConnection;
  let fs: MockFileSystem;

  beforeEach(() => {
    connection = mockConnection(mockRoot);
    connection.spies.sendRequest.mockReturnValue(Promise.resolve(true));
    capabilities = new ClientCapabilities();
    fs = new MockFileSystem(
      {
        'blocks/other-block.liquid': ``,
        'blocks/oldName.liquid': `
            {% schema %}
            {
              "name": "Old Block",
              "blocks": [
                {
                  "type": "other-block"
                }
              ]
            }
            {% endschema %}`,

        'sections/section.liquid': `
            <div>{% content_for "block", id: "oldName", type: "oldName" %}</div>
            {% schema %}
            {
              "name": "Section",
              "blocks": [
                {
                  "type": "oldName"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "oldName",
                      "blocks": [
                        {
                          "type": "other-block"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
            {% endschema %}`,

        'templates/index.json': `{
            "sections": {
              "custom-section": {
                "type": "custom-section",
                "blocks": {
                  "text_tqQTNE": {
                    "type": "oldName"
                  }
                },
                "block_order": ["text_tqQTNE"]
              }
            },
            "order": ["custom-section"]
          }`,
      },
      mockRoot,
    );
    documentManager = new DocumentManager(
      fs, // filesystem
      undefined, // optional mode getter
      undefined, // optional mode map
      async () => 'theme', // getModeForURI
      async () => true, // isValidSchema - assume all schemas are valid in tests
    );
    handler = new RenameHandler(connection, capabilities, documentManager, findThemeRootURI);
  });

  describe('when the client does not support workspace/applyEdit', () => {
    beforeEach(() => {
      capabilities.setup({
        workspace: {
          applyEdit: false,
        },
      });
    });

    it('does nothing', async () => {
      await handler.onDidRenameFiles({
        files: [
          {
            oldUri: 'mock-fs:/blocks/oldName.liquid',
            newUri: 'mock-fs:/blocks/newName.liquid',
          },
        ],
      });
      expect(connection.spies.sendRequest).not.toHaveBeenCalled();
    });
  });

  describe('when the client supports workspace/applyEdit', () => {
    beforeEach(() => {
      capabilities.setup({
        workspace: {
          applyEdit: true,
        },
      });
    });

    it('returns a needConfirmation: false workspace edit for renaming a block', async () => {
      await handler.onDidRenameFiles({
        files: [
          {
            oldUri: 'mock-fs:/blocks/oldName.liquid',
            newUri: 'mock-fs:/blocks/newName.liquid',
          },
        ],
      });

      const templateTextEdit = {
        annotationId: 'renameBlock',
        newText: 'newName',
        range: {
          start: { line: 6, character: 29 },
          end: { line: 6, character: 36 },
        },
      };

      const schemaTextEdits = [
        {
          annotationId: 'renameBlock',
          newText: 'newName',
          range: {
            start: { line: 7, character: 27 },
            end: { line: 7, character: 34 },
          },
        },
        {
          annotationId: 'renameBlock',
          newText: 'newName',
          range: {
            start: { line: 15, character: 31 },
            end: { line: 15, character: 38 },
          },
        },
        {
          annotationId: 'renameBlock',
          newText: 'newName',
          range: {
            start: { line: 1, character: 63 },
            end: { line: 1, character: 70 },
          },
        },
      ];

      expect(connection.spies.sendRequest).toHaveBeenCalledWith('workspace/applyEdit', {
        label: "Rename block 'oldName' to 'newName'",
        edit: {
          changeAnnotations: {
            renameBlock: {
              label: `Rename block 'oldName' to 'newName'`,
              needsConfirmation: false,
            },
          },
          documentChanges: [
            {
              textDocument: {
                uri: 'mock-fs:/sections/section.liquid',
                version: null,
              },
              edits: schemaTextEdits,
            },
            {
              textDocument: {
                uri: 'mock-fs:/templates/index.json',
                version: null,
              },
              edits: [templateTextEdit],
            },
          ],
        },
      });
    });

    it('replaces the correct text in the documents', async () => {
      await handler.onDidRenameFiles({
        files: [
          {
            oldUri: 'mock-fs:/blocks/oldName.liquid',
            newUri: 'mock-fs:/blocks/newName.liquid',
          },
        ],
      });

      const params: ApplyWorkspaceEditParams = connection.spies.sendRequest.mock.calls[0][1];
      const expectedFs = new MockFileSystem(
        {
          'blocks/newName.liquid': `
            {% schema %}
            {
              "name": "Old Block",
              "blocks": [
                {
                  "type": "other-block"
                }
              ]
            }
            {% endschema %}`,

          'sections/section.liquid': `
            <div>{% content_for "block", id: "oldName", type: "newName" %}</div>
            {% schema %}
            {
              "name": "Section",
              "blocks": [
                {
                  "type": "newName"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "newName",
                      "blocks": [
                        {
                          "type": "other-block"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
            {% endschema %}`,

          'templates/index.json': `{
            "sections": {
              "custom-section": {
                "type": "custom-section",
                "blocks": {
                  "text_tqQTNE": {
                    "type": "newName"
                  }
                },
                "block_order": ["text_tqQTNE"]
              }
            },
            "order": ["custom-section"]
          }`,
        },
        mockRoot,
      );

      assert(params.edit);
      assert(params.edit.documentChanges);

      for (const docChange of params.edit.documentChanges) {
        assert(TextDocumentEdit.is(docChange));
        const uri = docChange.textDocument.uri;
        const edits = docChange.edits;
        const initialDoc = await fs.readFile(uri);
        const expectedDoc = await expectedFs.readFile(uri);
        expect(edits).to.applyEdits(initialDoc, expectedDoc);
      }
    });

    it('preserves local block definitions', async () => {
      fs = new MockFileSystem(
        {
          'sections/oldName.liquid': `{% schema %}
          {
            "name": "Old Block",
            "blocks": [
              {
                "type": "local_block",
                "name": "Local Block"
              }
            ]
          }
          {% endschema %}`,
        },
        mockRoot,
      );
      documentManager = new DocumentManager(fs);
      handler = new RenameHandler(connection, capabilities, documentManager, findThemeRootURI);

      await handler.onDidRenameFiles({
        files: [
          {
            oldUri: 'mock-fs:/sections/oldName.liquid',
            newUri: 'mock-fs:/sections/newName.liquid',
          },
        ],
      });

      // Check if sendRequest was called at all
      expect(connection.spies.sendRequest).not.toHaveBeenCalled();
    });
  });
});
