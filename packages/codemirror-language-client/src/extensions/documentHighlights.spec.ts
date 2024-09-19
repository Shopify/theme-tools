// @vitest-environment jsdom
import { EditorState, Extension, Range, RangeSet, RangeValue } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DocumentHighlight } from 'vscode-languageserver-protocol';
import { MockClient } from '../test/MockClient';
import { clientFacet, fileUriFacet } from './client';
import { getDecorations, highlightDeco, lspDocumentHighlights } from './documentHighlights';
import { textDocumentSync } from './textDocumentSync';

describe('Module: documentHighlights', () => {
  const fileUri = 'browser://input.liquid';
  let client: MockClient;
  let extensions: Extension;
  let view: EditorView;
  let hoverRenderer: any;

  beforeEach(() => {
    client = new MockClient({}, { documentHighlightProvider: true });
    extensions = [
      clientFacet.of(client),
      fileUriFacet.of(fileUri),
      textDocumentSync,
      lspDocumentHighlights(),
    ];
    view = new EditorView({
      state: EditorState.create({
        doc: 'hello world',
        extensions,
      }),
    });
  });

  it('should translate LSP Document Highlights into a CodeMirror DecorationSet', async () => {
    const promise = getDecorations(view);
    const highlightsResponse: DocumentHighlight[] = [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
      },
    ];

    client.resolveRequest(highlightsResponse);
    const result = await promise;
    const actual = toArray(result);
    const expected = toArray(Decoration.set([highlightDeco.range(0, 5)]));
    expect(actual).to.eql(expected);
  });

  it('should sort the decorations', async () => {
    const promise = getDecorations(view);
    const highlightsResponse: DocumentHighlight[] = [
      {
        range: {
          start: { line: 0, character: 5 },
          end: { line: 0, character: 10 },
        },
      },
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
      },
    ];

    client.resolveRequest(highlightsResponse);
    const result = await promise;
    expect(toArray(result)).to.eql(
      toArray(Decoration.set([highlightDeco.range(0, 5), highlightDeco.range(5, 10)])),
    );
  });

  it('should return a Decoration.none DecorationSet', async () => {
    const promise = getDecorations(view);
    client.resolveRequest(null);
    const result = await promise;
    expect(toArray(result)).to.eql(toArray(Decoration.none));
  });

  /**
   * I wish CM didn't think that their implementation of iterators was better
   * than the built-in one. Makes testing that stuff really hard for what seems
   * like an obscure reason.
   *
   * > A range cursor is an object that moves to the next range every time you
   * > call next on it. Note that, unlike ES6 iterators, these start out pointing
   * > at the first element, so you should call next only after reading the first
   * > range (if any).
   *
   * Also, RangeSet.eq doesn't seem to work. Which is why I decided to take this
   * approach.
   */
  function* toIterator(decoSet: DecorationSet): Iterable<Range<Decoration>> {
    let iter = decoSet.iter();
    if (iter.value === null) {
      return;
    }

    do {
      yield { from: iter.from, to: iter.to, value: iter.value };
      iter.next();
    } while (iter.value !== null);
  }

  function toArray(decoSet: DecorationSet): Range<Decoration>[] {
    return Array.from(toIterator(decoSet));
  }
});
