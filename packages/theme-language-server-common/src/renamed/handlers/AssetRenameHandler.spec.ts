import { makeFileExists } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { TextDocumentEdit } from 'vscode-json-languageservice';
import { ApplyWorkspaceEditParams } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../documents';
import { MockConnection, mockConnection } from '../../test/MockConnection';
import { RenameHandler } from '../RenameHandler';

describe('Module: AssetRenameHandler', () => {
  let documentManager: DocumentManager;
  let handler: RenameHandler;
  let connection: MockConnection;
  let fs: MockFileSystem;
  beforeEach(() => {
    connection = mockConnection();
    connection.spies.sendRequest.mockReturnValue(Promise.resolve(true));
    fs = new MockFileSystem(
      {
        'assets/oldName.js': 'console.log("Hello, world!")',
        'sections/section.liquid': `<script src="{{ 'oldName.js' | asset_url }}" defer></script>`,
        'blocks/block.liquid': `{{ 'oldName.js' | asset_url | script_tag }} oldName.js`,
      },
      'mock-fs:',
    );
    documentManager = new DocumentManager(fs);
    handler = new RenameHandler(connection, documentManager, makeFileExists(fs));
  });

  it('returns a needConfirmation: false workspace edit for renaming an asset', async () => {
    await handler.onDidRenameFiles({
      files: [
        {
          oldUri: 'mock-fs:/assets/oldName.js',
          newUri: 'mock-fs:/assets/newName.js',
        },
      ],
    });

    const expectedTextEdit = {
      range: expect.any(Object),
      newText: 'newName.js',
    };

    expect(connection.spies.sendRequest).toHaveBeenCalledWith('workspace/applyEdit', {
      label: "Rename asset 'oldName.js' to 'newName.js'",
      edit: {
        changeAnnotations: {
          renameAsset: {
            label: `Rename asset 'oldName.js' to 'newName.js'`,
            needsConfirmation: false,
          },
        },
        documentChanges: [
          {
            textDocument: {
              uri: 'mock-fs:/sections/section.liquid',
              version: null,
            },
            edits: [expectedTextEdit],
            annotationId: 'renameAsset',
          },
          {
            textDocument: {
              uri: 'mock-fs:/blocks/block.liquid',
              version: null,
            },
            edits: [expectedTextEdit],
            annotationId: 'renameAsset',
          },
        ],
      },
    });
  });

  it('replaces the correct text in the documents', async () => {
    await handler.onDidRenameFiles({
      files: [
        {
          oldUri: 'mock-fs:/assets/oldName.js',
          newUri: 'mock-fs:/assets/newName.js',
        },
      ],
    });

    const params: ApplyWorkspaceEditParams = connection.spies.sendRequest.mock.calls[0][1];
    const expectedFs = new MockFileSystem(
      {
        'assets/oldName.js': 'console.log("Hello, world!")',
        'sections/section.liquid': `<script src="{{ 'newName.js' | asset_url }}" defer></script>`,
        'blocks/block.liquid': `{{ 'newName.js' | asset_url | script_tag }} oldName.js`,
      },
      'mock-fs:',
    );

    assert(params.edit);
    assert(params.edit.documentChanges);
    for (const docChange of params.edit.documentChanges) {
      assert(TextDocumentEdit.is(docChange));
      const uri = docChange.textDocument.uri;
      const edits = docChange.edits;
      const initialDoc = await fs.readFile(uri);
      const expectedDoc = await expectedFs.readFile(uri);
      const textDocument = TextDocument.create(uri, 'liquid', 0, initialDoc);
      expect(TextDocument.applyEdits(textDocument, edits)).toBe(expectedDoc);
    }
  });

  it('handles .js.liquid files', async (ext) => {
    await handler.onDidRenameFiles({
      files: [
        {
          oldUri: 'mock-fs:/assets/oldName.js',
          newUri: `mock-fs:/assets/newName.js.liquid`,
        },
      ],
    });

    const params: ApplyWorkspaceEditParams = connection.spies.sendRequest.mock.calls[0][1];
    const expectedFs = new MockFileSystem(
      {
        'assets/oldName.js': 'console.log("Hello, world!")',
        'sections/section.liquid': `<script src="{{ 'newName.js' | asset_url }}" defer></script>`,
        'blocks/block.liquid': `{{ 'newName.js' | asset_url | script_tag }} oldName.js`,
      },
      'mock-fs:',
    );

    assert(params.edit);
    assert(params.edit.documentChanges);
    for (const docChange of params.edit.documentChanges) {
      assert(TextDocumentEdit.is(docChange));
      const uri = docChange.textDocument.uri;
      const edits = docChange.edits;
      const initialDoc = await fs.readFile(uri);
      const expectedDoc = await expectedFs.readFile(uri);
      const textDocument = TextDocument.create(uri, 'liquid', 0, initialDoc);
      expect(TextDocument.applyEdits(textDocument, edits)).toBe(expectedDoc);
    }
  });

  it('handles .css.liquid files', async () => {
    fs = new MockFileSystem(
      {
        'assets/oldName.css.liquid': 'body { color: red; }',
        'sections/section.liquid': `{% echo 'oldName.css' | asset_url | stylesheet_tag %}`,
      },
      'mock-fs:',
    );
    documentManager = new DocumentManager(fs);
    handler = new RenameHandler(connection, documentManager, makeFileExists(fs));

    await handler.onDidRenameFiles({
      files: [
        {
          oldUri: 'mock-fs:/assets/oldName.css.liquid',
          newUri: `mock-fs:/assets/newName.css.liquid`,
        },
      ],
    });

    const params: ApplyWorkspaceEditParams = connection.spies.sendRequest.mock.calls[0][1];
    const expectedFs = new MockFileSystem(
      {
        'assets/newName.css.liquid': 'body { color: red; }',
        'sections/section.liquid': `{% echo 'newName.css' | asset_url | stylesheet_tag %}`,
      },
      'mock-fs:',
    );

    assert(params.edit);
    assert(params.edit.documentChanges);
    for (const docChange of params.edit.documentChanges) {
      assert(TextDocumentEdit.is(docChange));
      const uri = docChange.textDocument.uri;
      const edits = docChange.edits;
      const initialDoc = await fs.readFile(uri);
      const expectedDoc = await expectedFs.readFile(uri);
      const textDocument = TextDocument.create(uri, 'liquid', 0, initialDoc);
      expect(TextDocument.applyEdits(textDocument, edits)).toBe(expectedDoc);
    }
  });
});
