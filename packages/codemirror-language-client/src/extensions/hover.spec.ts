// @vitest-environment jsdom
import { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockClient } from '../test/MockClient';
import { clientFacet, fileUriFacet } from './client';
import { hover, hoverRendererFacet, lspHover } from './hover';
import { textDocumentSync } from './textDocumentSync';
import { Hover } from 'vscode-languageserver-protocol';

describe('Module: hover', () => {
  const fileUri = 'browser://input.liquid';
  let client: MockClient;
  let extensions: Extension;
  let view: EditorView;
  let hoverRenderer: any;

  beforeEach(() => {
    client = new MockClient();
    hoverRenderer = vi.fn().mockReturnValue(null);
    extensions = [
      clientFacet.of(client),
      fileUriFacet.of(fileUri),
      textDocumentSync,
      hoverRendererFacet.of(hoverRenderer),
      lspHover(),
    ];
    view = new EditorView({
      state: EditorState.create({
        doc: 'hello world',
        extensions,
      }),
    });
  });

  it('should translate LSP hover requests into CodeMirror hover tooltips', async () => {
    const promise = hover(view, /* doesnt matter for unit test */ 0, 1);

    const hoverResponse: Hover = {
      contents: {
        kind: 'markdown',
        value: '### echo hello world',
      },
    };

    client.resolveRequest(hoverResponse);
    const result = await promise;

    expect(result).toEqual({
      pos: 0,
      end: 5,
      above: true,
      arrow: false,
      create: expect.any(Function),
    });

    result!.create(view);

    expect(hoverRenderer).toHaveBeenCalledWith(view, hoverResponse);
  });

  it('should return null if nothing comes back', async () => {
    const promise = hover(view, 0, 1);
    client.resolveRequest(null);
    const result = await promise;
    expect(result).to.eql(null);
  });
});
