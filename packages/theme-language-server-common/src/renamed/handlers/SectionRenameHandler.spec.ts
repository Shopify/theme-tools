import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { TextDocumentEdit } from 'vscode-json-languageservice';
import { ApplyWorkspaceEditParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DocumentManager } from '../../documents';
import { MockConnection, mockConnection } from '../../test/MockConnection';
import { RenameHandler } from '../RenameHandler';

describe('Module: SectionRenameHandler', () => {
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
        'sections/old-name.liquid': `
            {% schema %}
              {
                "name": "Old name"
              }
            {% endschema %}`,

        'layout/theme.liquid': `
            {% section 'old-name' %}
          `,

        'sections/header.json': `
            {
              "type": "header",
              "name": "Header",
              "sections": {
                "section-id": {
                  "type": "old-name"
                }
              },
              "order": ["section-id"]
            }`,

        'templates/index.json': `
            {
              "sections": {
                "section-id": {
                  "type": "old-name"
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
            oldUri: 'mock-fs:/sections/old-name.liquid',
            newUri: 'mock-fs:/sections/new-name.liquid',
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

    it('returns a needConfirmation: false workspace edit for renaming a section', async () => {
      await handler.onDidRenameFiles({
        files: [
          {
            oldUri: 'mock-fs:/sections/old-name.liquid',
            newUri: 'mock-fs:/sections/new-name.liquid',
          },
        ],
      });

      const replaceWithNewNameTextEditAtAnyLocation = {
        annotationId: 'renameSection',
        newText: 'new-name',
        range: {
          start: expect.any(Object),
          end: expect.any(Object),
        },
      };

      const templateTextEdits = [
        // Section type is updated in the section sections array
        replaceWithNewNameTextEditAtAnyLocation,
      ];

      const sectionGroupTextEdits = [
        // Section type is updated in the section sections array,
        replaceWithNewNameTextEditAtAnyLocation,
      ];

      const sectionTagTextEdits = [
        // Over {% section 'old-name' %}
        replaceWithNewNameTextEditAtAnyLocation,
      ];

      expect(connection.spies.sendRequest).toHaveBeenCalledWith('workspace/applyEdit', {
        label: "Rename section 'old-name' to 'new-name'",
        edit: {
          changeAnnotations: {
            renameSection: {
              label: `Rename section 'old-name' to 'new-name'`,
              needsConfirmation: false,
            },
          },
          documentChanges: expect.arrayContaining([
            {
              textDocument: {
                uri: 'mock-fs:/layout/theme.liquid',
                version: null,
              },
              edits: sectionTagTextEdits,
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
            oldUri: 'mock-fs:/sections/old-name.liquid',
            newUri: 'mock-fs:/sections/new-name.liquid',
          },
        ],
      });

      const params: ApplyWorkspaceEditParams = connection.spies.sendRequest.mock.calls[0][1];
      const expectedFs = new MockFileSystem(
        {
          'sections/new-name.liquid': `
            {% schema %}
              {
                "name": "Old name"
              }
            {% endschema %}`,

          'layout/theme.liquid': `
            {% section 'new-name' %}
          `,

          'sections/header.json': `
            {
              "type": "header",
              "name": "Header",
              "sections": {
                "section-id": {
                  "type": "new-name"
                }
              },
              "order": ["section-id"]
            }`,

          'templates/index.json': `
            {
              "sections": {
                "section-id": {
                  "type": "new-name"
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

    it('preserves local section definitions', async () => {
      fs = new MockFileSystem(
        {
          // a "theme" text section exists
          'sections/text.liquid': `
            {% schema %}
              { "name": "text section" }
            {% endschema %}`,

          // this section uses a local section of type "text"
          'sections/local.liquid': `
            {% schema %}
              {
                "name": "Section with local sections",
                "sections": [
                  {
                    "type": "text",
                    "name": "Local text section"
                  }
                ],
                "presets": [
                  {
                    "name": "Because text is a local section definition, this preset won't get a rename",
                    "sections": [
                      { "type": "text" }
                    ]
                  }
                ]
              }
            {% endschema %}`,

          // This section group uses the local section that uses the local section, no rename needed
          'sections/header.json': JSON.stringify({
            type: 'header',
            name: 'Header',
            sections: {
              local_id: {
                type: 'local',
                sections: {
                  text_tqQTNE: {
                    type: 'text',
                  },
                },
                section_order: ['text_tqQTNE'],
              },
            },
            order: ['local_id'],
          }),

          // This template uses the section that uses the local section, no rename needed
          'templates/index.json': JSON.stringify({
            sections: {
              local: {
                type: 'local',
                sections: {
                  text_tqQTNE: {
                    type: 'text',
                  },
                },
                section_order: ['text_tqQTNE'],
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
            oldUri: 'mock-fs:/sections/text.liquid',
            newUri: 'mock-fs:/sections/poetry.liquid',
          },
        ],
      });

      // Check if sendRequest was called at all
      expect(connection.spies.sendRequest).not.toHaveBeenCalled();
    });
  });
});
