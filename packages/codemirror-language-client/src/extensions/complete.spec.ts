import { vi, expect, describe, it, beforeEach } from 'vitest';
import { EditorState, Extension } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { clientFacet, fileUriFacet } from './client';
import { MockClient } from '../test/MockClient';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-protocol';
import { textDocumentSync } from './textDocumentSync';
import { complete, infoRendererFacet, lspComplete } from './complete';

describe('Module: complete', () => {
  const fileUri = 'browser://input.liquid';
  let client: MockClient;
  let extensions: Extension;
  let state: EditorState;
  let infoRenderer: any;

  beforeEach(() => {
    client = new MockClient();
    infoRenderer = vi.fn().mockReturnValue(null);
    extensions = [
      clientFacet.of(client),
      fileUriFacet.of(fileUri),
      textDocumentSync,
      infoRendererFacet.of(infoRenderer),
      lspComplete(),
    ];
    state = EditorState.create({
      doc: 'hello world',
      extensions,
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

  it('should return null if nothing comes back', async () => {
    const context = new CompletionContext(state, /* does not matter for mock test */ 0, true);
    const promise = complete(context);
    client.resolveRequest(null);
    const results = await promise;
    expect(results).to.eql(null);
  });
});
