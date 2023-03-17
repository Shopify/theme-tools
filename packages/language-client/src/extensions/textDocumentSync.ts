import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
} from 'vscode-languageserver-protocol';
import { Extension, StateField } from '@codemirror/state';
import {
  EditorView,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';

import { LanguageClient } from '../LanguageClient';

import { clientFacet, fileUriFacet } from './client';

class TextDocumentSyncPlugin implements PluginValue {
  private client: LanguageClient;
  private uri: string;

  constructor(view: EditorView) {
    const doc = view.state.field(textDocumentField);
    this.client = view.state.facet(clientFacet);
    this.uri = doc.uri;

    // Here we initialize the state in the Language Server by sending a
    // textDocument/didOpen notification.
    this.client.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: doc.uri,
        version: doc.version,
        languageId: doc.languageId,
        text: doc.getText(),
      },
    });
  }

  update(update: ViewUpdate) {
    if (!update.docChanged) return;
    const doc = update.state.field(textDocumentField);

    // Here we send the textDocument/didChange notification to the server
    // to tell it the file was modified. The version attribute is used to
    // verify if the server and client are in sync (if the versions don't
    // match, they aren't).
    this.client.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: {
        uri: doc.uri,
        version: doc.version,
      },
      contentChanges: [
        {
          text: doc.getText(),
        },
      ],
    });
  }

  destroy() {
    this.client.sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: {
        uri: this.uri,
      },
    });
  }
}

export const textDocumentField = StateField.define<TextDocument>({
  create(state) {
    const fileUri = state.facet(fileUriFacet);
    const version = 0;
    return TextDocument.create(
      fileUri,
      languageId(fileUri),
      version,
      state.doc.sliceString(0, state.doc.length),
    );
  },
  update(previousValue, tr) {
    if (!tr.docChanged) return previousValue;
    return TextDocument.create(
      previousValue.uri,
      previousValue.languageId,
      previousValue.version + 1,
      tr.newDoc.sliceString(0, tr.newDoc.length),
    );
  },
});

// Implicitly depends on the fileUriFacet and clientFacet...
// Don't know how that's typically handled yet...
export const textDocumentSync: Extension = [
  textDocumentField,
  ViewPlugin.fromClass(TextDocumentSyncPlugin),
];

function languageId(uri: string): string {
  const lowerCased = uri.toLowerCase();
  if (lowerCased.endsWith('.liquid')) {
    return 'liquid';
  } else if (lowerCased.endsWith('.js')) {
    return 'javascript';
  } else if (lowerCased.endsWith('.css')) {
    return 'css';
  } else {
    return 'unknown';
  }
}
