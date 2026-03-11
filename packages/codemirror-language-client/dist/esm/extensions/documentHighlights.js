/**
 * This extension requests LSP Document Highlights [1] when the user types or
 * change its code selection.
 *
 * Those are then transformed into CodeMirror decorations and applied to the editor.
 *
 * [1]: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentHighlight
 */
import { Prec, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { DocumentHighlightRequest } from 'vscode-languageserver-protocol';
import { clientFacet, fileUriFacet } from './client';
import { textDocumentField } from './textDocumentSync';
// We will use this CSS class to decorate all document highlights
export const documentHighlightsClass = 'cmlc-document-highlights';
export const highlightDeco = Decoration.mark({ class: documentHighlightsClass });
const highlightStyles = Prec.low(EditorView.theme({
    [`.${documentHighlightsClass}`]: {
        // Set background color to a light gray that matches a subtle highlight on
        // a light theme
        'background-color': 'rgba(0,0,0,0.1)',
    },
}));
const setDocumentHighlights = StateEffect.define();
const documentHighlightsStateField = StateField.define({
    create: () => Decoration.none,
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
    provide: (f) => EditorView.decorations.from(f),
});
export async function getDecorations(view) {
    var _a;
    const client = view.state.facet(clientFacet.reader);
    const uri = view.state.facet(fileUriFacet.reader);
    const textDocument = view.state.field(textDocumentField);
    // If the client doesn't support those requests, don't ask for them.
    if (!((_a = client.serverCapabilities) === null || _a === void 0 ? void 0 : _a.documentHighlightProvider)) {
        return Decoration.none;
    }
    const results = await client.sendRequest(DocumentHighlightRequest.type, {
        textDocument: { uri },
        position: textDocument.positionAt(view.state.selection.main.from),
    });
    if (!results) {
        return Decoration.none;
    }
    const decorations = results
        .map((highlight) => ({
        from: textDocument.offsetAt(highlight.range.start),
        to: textDocument.offsetAt(highlight.range.end),
    }))
        .sort((a, b) => a.from - b.from) // CM wants them sorted ascending or else it freaks out
        .map(({ from, to }) => highlightDeco.range(from, to));
    return Decoration.set(decorations);
}
export function lspDocumentHighlights() {
    const decorationHandler = EditorView.updateListener.of((update) => {
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
//# sourceMappingURL=documentHighlights.js.map