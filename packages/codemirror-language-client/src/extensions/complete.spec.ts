import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionItem, CompletionItemKind, CompletionList } from 'vscode-languageserver-protocol';
import { MockClient } from '../test/MockClient';
import { clientFacet, fileUriFacet, serverCapabilitiesFacet } from './client';
import { complete, infoRendererFacet, lspComplete } from './complete';
import { textDocumentSync } from './textDocumentSync';

describe('Module: complete', () => {
  const fileUri = 'browser://input.liquid';
  let client: MockClient;
  let state: EditorState;
  let infoRenderer: any;
  let doc: string;

  beforeEach(() => {
    doc = 'hello. ;';
    client = new MockClient();
    infoRenderer = vi.fn().mockReturnValue(null);
    state = EditorState.create({
      doc,
      extensions: [
        clientFacet.of(client),
        serverCapabilitiesFacet.of({
          completionProvider: {
            triggerCharacters: ['.'],
          },
        }),
        fileUriFacet.of(fileUri),
        textDocumentSync,
        infoRendererFacet.of(infoRenderer),
        lspComplete(),
      ],
    });
  });

  it('should translate LSP completion responses into CodeMirror completion items', async () => {
    const context = new CompletionContext(state, /* does not matter for mock test */ 0, true);
    const promise = complete(context);

    client.resolveRequest([
      {
        label: 'hello | world',
        insertText: 'hello',
        kind: CompletionItemKind.Text,
      },
      {
        label: 'echo',
        kind: CompletionItemKind.Function,
        documentation: {
          kind: 'markdown',
          value: '### echo',
        },
      },
      {
        label: '"general.greeting" | t',
        insertText: 'greeting',
        textEdit: {
          newText: '"general.greeting" | t',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 3 },
          },
        },
        kind: CompletionItemKind.Function,
        documentation: {
          kind: 'markdown',
          value: '### echo',
        },
      },
    ] as CompletionItem[]);
    const results = await promise;

    expect(results).toEqual({
      from: 0,
      options: [
        {
          label: 'hello',
          displayLabel: 'hello | world',
          type: 'text',
          info: expect.any(Function),
          apply: undefined,
        },
        {
          label: 'echo',
          displayLabel: 'echo',
          type: 'function',
          info: expect.any(Function),
          apply: undefined,
        },
        {
          displayLabel: '"general.greeting" | t',
          label: 'greeting',
          type: 'function',
          info: expect.any(Function),
          apply: expect.any(Function),
        },
      ],
    });
  });

  it('should translate LSP completion list responses into CodeMirror completion items', async () => {
    const context = new CompletionContext(state, /* does not matter for mock test */ 0, true);
    const promise = complete(context);

    client.resolveRequest({
      isIncomplete: false,
      items: [
        {
          label: 'hello | world',
          insertText: 'hello',
          kind: CompletionItemKind.Text,
        },
        {
          label: 'echo',
          kind: CompletionItemKind.Function,
          documentation: {
            kind: 'markdown',
            value: '### echo',
          },
        },
        {
          label: '"general.greeting" | t',
          insertText: 'greeting',
          textEdit: {
            newText: '"general.greeting" | t',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 3 },
            },
          },
          kind: CompletionItemKind.Function,
          documentation: {
            kind: 'markdown',
            value: '### echo',
          },
        },
      ],
    } as CompletionList);
    const results = await promise;

    expect(results).toEqual({
      from: 0,
      options: [
        {
          label: 'hello',
          displayLabel: 'hello | world',
          type: 'text',
          info: expect.any(Function),
          apply: undefined,
        },
        {
          label: 'echo',
          displayLabel: 'echo',
          type: 'function',
          info: expect.any(Function),
          apply: undefined,
        },
        {
          displayLabel: '"general.greeting" | t',
          label: 'greeting',
          type: 'function',
          info: expect.any(Function),
          apply: expect.any(Function),
        },
      ],
    });
  });

  it('should return null if not on a trigger character nor inside a word', async () => {
    const context = new CompletionContext(state, doc.indexOf(';'), true);
    const promise = complete(context);
    assert(!client.pendingRequest);
    const result = await promise;
    expect(result).to.be.null;
  });

  it('should make a request to the backend if after a trigger character', async () => {
    const context = new CompletionContext(state, doc.indexOf('.') + 1, true);
    complete(context);
    assert(client.pendingRequest);
    client.resolveRequest(null);
  });

  it('should make a request to the backend if after a word character', async () => {
    const context = new CompletionContext(state, doc.indexOf('h') + 1, true);
    complete(context);
    assert(client.pendingRequest);
    client.resolveRequest(null);
  });

  it('should return null if nothing comes back', async () => {
    const context = new CompletionContext(state, /* does not matter for mock test */ 0, true);
    const promise = complete(context);
    client.resolveRequest(null);
    const results = await promise;
    expect(results).to.eql(null);
  });
});
