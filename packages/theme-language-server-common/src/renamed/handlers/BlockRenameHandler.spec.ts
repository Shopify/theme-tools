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
        'blocks/old-name.liquid': `
            {% schema %}
              {
                "name": "Old Block",
                "blocks": [{ "type": "other-block" }],
                "presets": [{
                  "name": "Default",
                  "blocks": [{
                    "type": "other-block"
                  }]
                }]
              }
            {% endschema %}`,

        'sections/section.liquid': `
            <div>{% content_for "block", id: "old-name-id", type: "old-name" %}</div>
            {% schema %}
              {
                "name": "Section",
                "blocks": [{ "type": "old-name" }],
                "presets": [
                  {
                    "name": "Default",
                    "blocks": [
                      {
                        "type": "old-name",
                        "blocks": [{ "type": "other-block" }]
                      }
                    ]
                  }
                ]
              }
            {% endschema %}`,

        'sections/header.json': `
            {
              "type": "header",
              "name": "Header",
              "sections": {
                "section-id": {
                  "type": "section",
                  "blocks": {
                    "old-name-id": {
                      "type": "old-name"
                    }
                  },
                  "block_order": ["old-name-id"]
                }
              },
              "order": ["section-id"]
            }`,

        'templates/index.json': `
            {
              "sections": {
                "section-id": {
                  "type": "section",
                  "blocks": {
                    "old-name-id": {
                      "type": "old-name"
                    }
                  },
                  "block_order": ["old-name-id"]
                }
              },
              "order": ["section-id"]
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
            oldUri: 'mock-fs:/blocks/old-name.liquid',
            newUri: 'mock-fs:/blocks/new-name.liquid',
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
            oldUri: 'mock-fs:/blocks/old-name.liquid',
            newUri: 'mock-fs:/blocks/new-name.liquid',
          },
        ],
      });

      const replaceWithNewNameTextEditAtAnyLocation = {
        annotationId: 'renameBlock',
        newText: 'new-name',
        range: {
          start: expect.any(Object),
          end: expect.any(Object),
        },
      };

      const templateTextEdits = [
        // Block type is updated in the section blocks array
        replaceWithNewNameTextEditAtAnyLocation,
      ];

      const sectionGroupTextEdits = [
        // Block type is updated in the section blocks array,
        replaceWithNewNameTextEditAtAnyLocation,
      ];

      const sectionFileTextEdits = [
        // In the content_for
        replaceWithNewNameTextEditAtAnyLocation,
        // In the blocks definition
        replaceWithNewNameTextEditAtAnyLocation,
        // In the presets
        replaceWithNewNameTextEditAtAnyLocation,
      ];

      expect(connection.spies.sendRequest).toHaveBeenCalledWith('workspace/applyEdit', {
        label: "Rename block 'old-name' to 'new-name'",
        edit: {
          changeAnnotations: {
            renameBlock: {
              label: `Rename block 'old-name' to 'new-name'`,
              needsConfirmation: false,
            },
          },
          documentChanges: expect.arrayContaining([
            {
              textDocument: {
                uri: 'mock-fs:/sections/section.liquid',
                version: null,
              },
              edits: sectionFileTextEdits,
            },
            {
              textDocument: {
                uri: 'mock-fs:/templates/index.json',
                version: null,
              },
              edits: templateTextEdits,
            },
            {
              textDocument: {
                uri: 'mock-fs:/sections/header.json',
                version: null,
              },
              edits: sectionGroupTextEdits,
            },
          ]),
        },
      });
    });

    it('replaces the correct text in the documents', async () => {
      await handler.onDidRenameFiles({
        files: [
          {
            oldUri: 'mock-fs:/blocks/old-name.liquid',
            newUri: 'mock-fs:/blocks/new-name.liquid',
          },
        ],
      });

      const params: ApplyWorkspaceEditParams = connection.spies.sendRequest.mock.calls[0][1];
      const expectedFs = new MockFileSystem(
        {
          'blocks/new-name.liquid': `
            {% schema %}
              {
                "name": "Old Block",
                "blocks": [{ "type": "other-block" }],
                "presets": [{
                  "name": "Default",
                  "blocks": [{
                    "type": "other-block"
                  }]
                }]
              }
            {% endschema %}`,

          // The old-name block type is updated, but not the id.
          'sections/section.liquid': `
            <div>{% content_for "block", id: "old-name-id", type: "new-name" %}</div>
            {% schema %}
              {
                "name": "Section",
                "blocks": [{ "type": "new-name" }],
                "presets": [
                  {
                    "name": "Default",
                    "blocks": [
                      {
                        "type": "new-name",
                        "blocks": [{ "type": "other-block" }]
                      }
                    ]
                  }
                ]
              }
            {% endschema %}`,

          'sections/header.json': `
            {
              "type": "header",
              "name": "Header",
              "sections": {
                "section-id": {
                  "type": "section",
                  "blocks": {
                    "old-name-id": {
                      "type": "new-name"
                    }
                  },
                  "block_order": ["old-name-id"]
                }
              },
              "order": ["section-id"]
            }`,

          // The old-name-id's block type is updated, but not the id.
          // This isn't a regex search and replace.
          'templates/index.json': `
            {
              "sections": {
                "section-id": {
                  "type": "section",
                  "blocks": {
                    "old-name-id": {
                      "type": "new-name"
                    }
                  },
                  "block_order": ["old-name-id"]
                }
              },
              "order": ["section-id"]
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
          // a "theme" text block exists
          'blocks/text.liquid': `
            {% schema %}
              { "name": "text block" }
            {% endschema %}`,

          // this section uses a local block of type "text"
          'sections/local.liquid': `
            {% schema %}
              {
                "name": "Section with local blocks",
                "blocks": [
                  {
                    "type": "text",
                    "name": "Local text block"
                  }
                ],
                "presets": [
                  {
                    "name": "Because text is a local block definition, this preset won't get a rename",
                    "blocks": [
                      { "type": "text" }
                    ]
                  }
                ]
              }
            {% endschema %}`,

          // This section group uses the local section that uses the local block, no rename needed
          'sections/header.json': JSON.stringify({
            type: 'header',
            name: 'Header',
            sections: {
              local_id: {
                type: 'local',
                blocks: {
                  text_tqQTNE: {
                    type: 'text',
                  },
                },
                block_order: ['text_tqQTNE'],
              },
            },
            order: ['local_id'],
          }),

          // This template uses the section that uses the local block, no rename needed
          'templates/index.json': JSON.stringify({
            sections: {
              local: {
                type: 'local',
                blocks: {
                  text_tqQTNE: {
                    type: 'text',
                  },
                },
                block_order: ['text_tqQTNE'],
              },
            },
          }),
        },
        mockRoot,
      );
      documentManager = new DocumentManager(
        fs,
        undefined,
        undefined,
        async () => 'theme',
        async () => true,
      );
      handler = new RenameHandler(connection, capabilities, documentManager, findThemeRootURI);

      await handler.onDidRenameFiles({
        files: [
          {
            oldUri: 'mock-fs:/blocks/text.liquid',
            newUri: 'mock-fs:/blocks/poetry.liquid',
          },
        ],
      });

      // Check if sendRequest was called at all
      expect(connection.spies.sendRequest).not.toHaveBeenCalled();
    });
  });
});
