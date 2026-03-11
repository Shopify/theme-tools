(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "vscode-languageserver-textdocument", "vscode-languageserver-protocol", "@codemirror/state", "@codemirror/view", "./client"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.textDocumentSync = exports.textDocumentField = void 0;
    const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
    const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
    const state_1 = require("@codemirror/state");
    const view_1 = require("@codemirror/view");
    const client_1 = require("./client");
    class TextDocumentSyncPlugin {
        constructor(view) {
            const doc = view.state.field(exports.textDocumentField);
            this.client = view.state.facet(client_1.clientFacet);
            this.uri = doc.uri;
            this.openFile(doc);
        }
        update(update) {
            const doc = update.state.field(exports.textDocumentField);
            const prevFileUri = update.startState.facet(client_1.fileUriFacet.reader);
            const currFileUri = update.state.facet(client_1.fileUriFacet.reader);
            if (prevFileUri !== currFileUri) {
                this.closeFile(prevFileUri);
                this.openFile(doc);
                this.uri = currFileUri;
            }
            else if (update.docChanged) {
                this.changeFile(doc);
            }
        }
        destroy() {
            this.closeFile(this.uri);
        }
        openFile(doc) {
            // Here we initialize the state in the Language Server by sending a
            // textDocument/didOpen notification.
            this.client.sendNotification(vscode_languageserver_protocol_1.DidOpenTextDocumentNotification.type, {
                textDocument: {
                    uri: doc.uri,
                    version: doc.version,
                    languageId: doc.languageId,
                    text: doc.getText(),
                },
            });
        }
        changeFile(doc) {
            // Here we send the textDocument/didChange notification to the server
            // to tell it the file was modified. The version attribute is used to
            // verify if the server and client are in sync (if the versions don't
            // match, they aren't).
            this.client.sendNotification(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type, {
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
        closeFile(uri) {
            this.client.sendNotification(vscode_languageserver_protocol_1.DidCloseTextDocumentNotification.type, {
                textDocument: {
                    uri,
                },
            });
        }
    }
    exports.textDocumentField = state_1.StateField.define({
        create(state) {
            const fileUri = state.facet(client_1.fileUriFacet.reader);
            const version = 0;
            return vscode_languageserver_textdocument_1.TextDocument.create(fileUri, languageId(fileUri), version, state.doc.sliceString(0, state.doc.length));
        },
        update(previousValue, tr) {
            const prevFileUri = tr.startState.facet(client_1.fileUriFacet.reader);
            const currFileUri = tr.state.facet(client_1.fileUriFacet.reader);
            const isNewFile = prevFileUri !== currFileUri;
            const doc = tr.newDoc;
            if (isNewFile) {
                const version = 0;
                return vscode_languageserver_textdocument_1.TextDocument.create(currFileUri, languageId(currFileUri), version, doc.sliceString(0, doc.length));
            }
            else if (tr.docChanged) {
                return vscode_languageserver_textdocument_1.TextDocument.create(previousValue.uri, previousValue.languageId, previousValue.version + 1, doc.sliceString(0, doc.length));
            }
            return previousValue;
        },
    });
    const textDocumentSyncPlugin = view_1.ViewPlugin.fromClass(TextDocumentSyncPlugin);
    // Implicitly depends on the fileUriFacet and clientFacet...
    // Don't know how that's typically handled yet...
    exports.textDocumentSync = [exports.textDocumentField, textDocumentSyncPlugin];
    function languageId(uri) {
        const lowerCased = uri.toLowerCase();
        if (lowerCased.endsWith('.liquid')) {
            return 'liquid';
        }
        else if (lowerCased.endsWith('.js')) {
            return 'javascript';
        }
        else if (lowerCased.endsWith('.css')) {
            return 'css';
        }
        else {
            return 'unknown';
        }
    }
});
//# sourceMappingURL=textDocumentSync.js.map