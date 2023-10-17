import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
} from 'vscode-languageserver-protocol';
import { Extension, StateField } from '@codemirror/state';
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from '@codemirror/view';

import { AbstractLanguageClient } from '../LanguageClient';

import { clientFacet, fileUriFacet } from './client';

class TextDocumentSyncPlugin implements PluginValue {
  private client: AbstractLanguageClient;
  private uri: string;

  constructor(view: EditorView) {
    const doc = view.state.field(textDocumentField);
    this.client = view.state.facet(clientFacet);
    this.uri = doc.uri;
    this.openFile(doc);
  }

  update(update: ViewUpdate) {
    const doc = update.state.field(textDocumentField);
    const prevFileUri = update.startState.facet(fileUriFacet.reader);
    const currFileUri = update.state.facet(fileUriFacet.reader);

    if (prevFileUri !== currFileUri) {
      this.closeFile(prevFileUri);
      this.openFile(doc);
      this.uri = currFileUri;
    } else if (update.docChanged) {
      this.changeFile(doc);
    }
  }

  destroy() {
    this.closeFile(this.uri);
  }

  private openFile(doc: TextDocument) {
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

  private changeFile(doc: TextDocument) {
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

  private closeFile(uri: string) {
    this.client.sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: {
        uri,
      },
    });
  }
}

export const textDocumentField = StateField.define<TextDocument>({
  create(state) {
    const fileUri = state.facet(fileUriFacet.reader);
    const version = 0;
    return TextDocument.create(
      fileUri,
      languageId(fileUri),
      version,
      state.doc.sliceString(0, state.doc.length),
    );
  },
  update(previousValue, tr) {
    const prevFileUri = tr.startState.facet(fileUriFacet.reader);
    const currFileUri = tr.state.facet(fileUriFacet.reader);
    const isNewFile = prevFileUri !== currFileUri;
    const doc = tr.newDoc;
    if (isNewFile) {
      const version = 0;
      return TextDocument.create(
        currFileUri,
        languageId(currFileUri),
        version,
        doc.sliceString(0, doc.length),
      );
    } else if (tr.docChanged) {
      return TextDocument.create(
        previousValue.uri,
        previousValue.languageId,
        previousValue.version + 1,
        doc.sliceString(0, doc.length),
      );
    }
    return previousValue;
  },
});

const textDocumentSyncPlugin = ViewPlugin.fromClass(TextDocumentSyncPlugin);

// Implicitly depends on the fileUriFacet and clientFacet...
// Don't know how that's typically handled yet...
export const textDocumentSync: Extension = [textDocumentField, textDocumentSyncPlugin];

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
