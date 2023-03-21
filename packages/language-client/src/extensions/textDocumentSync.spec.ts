// @vitest-environment jsdom
import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';
import { EditorState, Extension, StateEffect } from '@codemirror/state';
import { textDocumentField, textDocumentSync } from './textDocumentSync';
import { clientFacet, fileUriFacet } from './client';
import { AbstractLanguageClient } from '../LanguageClient';
import {
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
} from 'vscode-languageserver-protocol';
import { EditorView } from '@codemirror/view';

describe('Module: textDocumentField', () => {
  let state;

  it('should instantiate the document with a version', () => {
    state = EditorState.create({
      doc: 'hello world',
      extensions: [fileUriFacet.of('browser://input.liquid'), textDocumentSync],
    });

    const t1 = state.field(textDocumentField);
    expect(t1.version).to.equal(0);
  });

  it('should increase the version if the document changes', () => {
    state = EditorState.create({
      doc: 'hello world',
      extensions: [fileUriFacet.of('browser://input.liquid'), textDocumentSync],
    });

    const t1 = state.field(textDocumentField);
    state = state.update({
      changes: {
        from: 0,
        to: 'hello world'.indexOf(' '),
        insert: 'hi',
      },
    }).state;

    const t2 = state.field(textDocumentField);
    expect(t1).not.to.equal(t2);
    expect(t2.version).to.equal(t1.version + 1);
  });

  it('should not increase the version if the document does not change', () => {
    state = EditorState.create({
      doc: 'hello world',
      extensions: [fileUriFacet.of('browser://input.liquid'), textDocumentSync],
    });

    const t1 = state.field(textDocumentField);
    state = state.update({
      changes: {
        from: 0,
        to: 0,
        insert: '',
      },
    }).state;

    const t2 = state.field(textDocumentField);
    expect(t1).to.equal(t2);
  });

  it('should reset the version if the file URI changes', () => {
    state = EditorState.create({
      doc: 'hello world',
      extensions: [fileUriFacet.of('browser://input.liquid'), textDocumentSync],
    });

    const t1 = state.field(textDocumentField);
    state = state.update({
      effects: StateEffect.reconfigure.of([
        fileUriFacet.of('browser://renamed.liquid'),
        textDocumentSync,
      ]),
    }).state;

    const t2 = state.field(textDocumentField);
    expect(t1).not.to.equal(t2);
    expect(t1.uri).to.equal('browser://input.liquid');
    expect(t1.version).to.equal(0);
    expect(t2.uri).to.equal('browser://renamed.liquid');
    expect(t2.version).to.equal(0);
  });
});

describe('Module: TextDocumentSyncPlugin', () => {
  let state: EditorState, client: AbstractLanguageClient, extensions: Extension;
  let view: EditorView;

  beforeEach(() => {
    client = {
      clientCapabilities: {},
      serverCapabilities: null,
      serverInfo: null,
      sendRequest: vi.fn() as any,
      sendNotification: vi.fn() as any,
      onRequest: vi.fn() as any,
      onNotification: vi.fn() as any,
    };
    extensions = [
      clientFacet.of(client),
      fileUriFacet.of('browser://input.liquid'),
      textDocumentSync,
    ];
    state = EditorState.create({
      doc: 'hello world',
      extensions,
    });
    view = new EditorView({
      state,
    });
  });

  afterEach(() => {
    view.destroy();
  });

  it('should send a textDocument/didOpen notification on start', () => {
    expect(client.sendNotification).toBeCalledTimes(1);
    expect(client.sendNotification).toBeCalledWith(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: 'browser://input.liquid',
        version: 0,
        languageId: 'liquid',
        text: 'hello world',
      },
    });
  });

  it('should send textDocument/didChange notifications on change', () => {
    view.dispatch({
      changes: {
        from: 0,
        to: 'hello world'.indexOf(' '),
        insert: 'hi',
      },
    });

    expect(client.sendNotification).toBeCalledTimes(2);
    expect(client.sendNotification).toBeCalledWith(DidChangeTextDocumentNotification.type, {
      textDocument: {
        uri: 'browser://input.liquid',
        version: 1,
      },
      contentChanges: [
        {
          text: 'hi world',
        },
      ],
    });
  });

  it('should send textDocument/didClose notification when destroyed', () => {
    view.dispatch({
      effects: StateEffect.reconfigure.of([
        clientFacet.of(client),
        fileUriFacet.of('browser://input.liquid'),
      ]),
    });

    expect(client.sendNotification).toBeCalledTimes(2);
    expect(client.sendNotification).toBeCalledWith(DidCloseTextDocumentNotification.type, {
      textDocument: {
        uri: 'browser://input.liquid',
      },
    });
  });

  it('should send textDocument/didClose and textDocument/didOpen notifications when the file URI changes', () => {
    view.dispatch({
      effects: StateEffect.reconfigure.of([
        clientFacet.of(client),
        fileUriFacet.of('browser://other-file.liquid'),
        textDocumentSync,
      ]),
    });

    expect(client.sendNotification).toBeCalledTimes(3);
    expect(client.sendNotification).toBeCalledWith(DidCloseTextDocumentNotification.type, {
      textDocument: {
        uri: 'browser://input.liquid',
      },
    });
    expect(client.sendNotification).toBeCalledWith(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: 'browser://other-file.liquid',
        version: 0,
        languageId: 'liquid',
        text: 'hello world',
      },
    });
  });
});
