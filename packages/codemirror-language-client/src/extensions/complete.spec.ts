import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';
import { EditorState, Extension } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { clientFacet, fileUriFacet } from './client';
import { MockClient } from '../test/MockClient';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-protocol';
import { textDocumentSync } from './textDocumentSync';
import { completeLiquidHTML, infoRendererFacet, liquidHTMLCompletionExtension } from './complete';

describe('Module: completeLiquidHTML', () => {
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
      liquidHTMLCompletionExtension,
    ];
    state = EditorState.create({
      doc: 'hello world',
      extensions,
    });
  });

  it('should translate LSP completion responses into CodeMirror completion items', async () => {
    const context = new CompletionContext(state, /* does not matter for mock test */ 0, true);
    const promise = completeLiquidHTML(context);

    client.resolveRequest([
      { label: 'hello', kind: CompletionItemKind.Text },
      {
        label: 'echo',
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
        { label: 'hello', type: 'text', info: expect.anything() },
        { label: 'echo', type: 'function', info: expect.anything() },
      ],
    });
  });

  it('should return null if nothing comes back', async () => {
    const context = new CompletionContext(state, /* does not matter for mock test */ 0, true);
    const promise = completeLiquidHTML(context);
    client.resolveRequest(null);
    const results = await promise;
    expect(results).to.eql(null);
  });
});
