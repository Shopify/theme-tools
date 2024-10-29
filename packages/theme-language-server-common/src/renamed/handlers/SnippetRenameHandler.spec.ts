import { makeFileExists } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextDocumentEdit } from 'vscode-json-languageservice';
import { ApplyWorkspaceEditParams } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../documents';
import { MockConnection, mockConnection } from '../../test/MockConnection';
import { RenameHandler } from '../RenameHandler';

describe('Module: SnippetRenameHandler', () => {
  let documentManager: DocumentManager;
  let handler: RenameHandler;
  let connection: MockConnection;
  let fs: MockFileSystem;
  beforeEach(() => {
    connection = mockConnection();
    connection.spies.sendRequest.mockReturnValue(Promise.resolve(true));
    fs = new MockFileSystem(
      {
        'sections/section.liquid': `<div>{% render 'oldName', foo: 'bar' %}oldName</div>`,
        'blocks/block.liquid': `<div>{% render 'oldName', foo: 'baz' %}</div>`,
        'snippets/oldName.liquid': `<div>oldName{%</div>`,
        'snippets/other.liquid': `<div>{% render 'oldName' %}{% render 'other' %}</div>`,
      },
      'mock-fs:',
    );
    documentManager = new DocumentManager(fs);
    handler = new RenameHandler(connection, documentManager, makeFileExists(fs));
  });

  it('returns a needConfirmation: false workspace edit for renaming a snippet', async () => {
    await handler.onDidRenameFiles({
      files: [
        {
          oldUri: 'mock-fs:/snippets/oldName.liquid',
          newUri: 'mock-fs:/snippets/newName.liquid',
        },
      ],
    });

    const expectedTextEdit = {
      range: expect.any(Object),
      newText: 'newName',
    };

    expect(connection.spies.sendRequest).toHaveBeenCalledWith('workspace/applyEdit', {
      label: "Rename snippet 'oldName' to 'newName'",
      edit: {
        changeAnnotations: {
          renameSnippet: {
            label: `Rename snippet 'oldName' to 'newName'`,
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
            annotationId: 'renameSnippet',
          },
          {
            textDocument: {
              uri: 'mock-fs:/blocks/block.liquid',
              version: null,
            },
            edits: [expectedTextEdit],
            annotationId: 'renameSnippet',
          },
          {
            textDocument: {
              uri: 'mock-fs:/snippets/other.liquid',
              version: null,
            },
            edits: [expectedTextEdit],
            annotationId: 'renameSnippet',
          },
        ],
      },
    });
  });

  it('replaces the correct text in the documents', async () => {
    await handler.onDidRenameFiles({
      files: [
        {
          oldUri: 'mock-fs:/snippets/oldName.liquid',
          newUri: 'mock-fs:/snippets/newName.liquid',
        },
      ],
    });

    const params: ApplyWorkspaceEditParams = connection.spies.sendRequest.mock.calls[0][1];
    const expectedFs = new MockFileSystem(
      {
        'sections/section.liquid': `<div>{% render 'newName', foo: 'bar' %}oldName</div>`,
        'blocks/block.liquid': `<div>{% render 'newName', foo: 'baz' %}</div>`,
        'snippets/oldName.liquid': `<div>oldName</div>`,
        'snippets/other.liquid': `<div>{% render 'newName' %}{% render 'other' %}</div>`,
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
