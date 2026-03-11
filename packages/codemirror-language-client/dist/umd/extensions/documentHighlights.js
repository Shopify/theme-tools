(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "@codemirror/state", "@codemirror/view", "vscode-languageserver-protocol", "./client", "./textDocumentSync"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.highlightDeco = exports.documentHighlightsClass = void 0;
    exports.getDecorations = getDecorations;
    exports.lspDocumentHighlights = lspDocumentHighlights;
    /**
     * This extension requests LSP Document Highlights [1] when the user types or
     * change its code selection.
     *
     * Those are then transformed into CodeMirror decorations and applied to the editor.
     *
     * [1]: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentHighlight
     */
    const state_1 = require("@codemirror/state");
    const view_1 = require("@codemirror/view");
    const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
    const client_1 = require("./client");
    const textDocumentSync_1 = require("./textDocumentSync");
    // We will use this CSS class to decorate all document highlights
    exports.documentHighlightsClass = 'cmlc-document-highlights';
    exports.highlightDeco = view_1.Decoration.mark({ class: exports.documentHighlightsClass });
    const highlightStyles = state_1.Prec.low(view_1.EditorView.theme({
        [`.${exports.documentHighlightsClass}`]: {
            // Set background color to a light gray that matches a subtle highlight on
            // a light theme
            'background-color': 'rgba(0,0,0,0.1)',
        },
    }));
    const setDocumentHighlights = state_1.StateEffect.define();
    const documentHighlightsStateField = state_1.StateField.define({
        create: () => view_1.Decoration.none,
        update(value, tr) {
            let updatedValue = value;
            for (const effect of tr.effects) {
                if (effect.is(setDocumentHighlights)) {
                    updatedValue = effect.value;
                }
            }
            return updatedValue;
        },
        // This is some CM obscure API shit that registers this state field
        // into the CM state and makes it so CM will show the decorations
        provide: (f) => view_1.EditorView.decorations.from(f),
    });
    async function getDecorations(view) {
        var _a;
        const client = view.state.facet(client_1.clientFacet.reader);
        const uri = view.state.facet(client_1.fileUriFacet.reader);
        const textDocument = view.state.field(textDocumentSync_1.textDocumentField);
        // If the client doesn't support those requests, don't ask for them.
        if (!((_a = client.serverCapabilities) === null || _a === void 0 ? void 0 : _a.documentHighlightProvider)) {
            return view_1.Decoration.none;
        }
        const results = await client.sendRequest(vscode_languageserver_protocol_1.DocumentHighlightRequest.type, {
            textDocument: { uri },
            position: textDocument.positionAt(view.state.selection.main.from),
        });
        if (!results) {
            return view_1.Decoration.none;
        }
        const decorations = results
            .map((highlight) => ({
            from: textDocument.offsetAt(highlight.range.start),
            to: textDocument.offsetAt(highlight.range.end),
        }))
            .sort((a, b) => a.from - b.from) // CM wants them sorted ascending or else it freaks out
            .map(({ from, to }) => exports.highlightDeco.range(from, to));
        return view_1.Decoration.set(decorations);
    }
    function lspDocumentHighlights() {
        const decorationHandler = view_1.EditorView.updateListener.of((update) => {
            // We only want to query the language server for document highlights
            // the document has changed or the selection has moved
            if (update.docChanged || update.selectionSet) {
                getDecorations(update.view).then((deco) => {
                    update.view.dispatch({
                        effects: setDocumentHighlights.of(deco),
                    });
                });
            }
        });
        return [documentHighlightsStateField, decorationHandler, highlightStyles];
    }
});
//# sourceMappingURL=documentHighlights.js.map