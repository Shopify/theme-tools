/**
 * This extension requests LSP Document Highlights [1] when the user types or
 * change its code selection.
 *
 * Those are then transformed into CodeMirror decorations and applied to the editor.
 *
 * [1]: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentHighlight
 */
import { Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
export declare const documentHighlightsClass = "cmlc-document-highlights";
export declare const highlightDeco: Decoration;
export declare function getDecorations(view: EditorView): Promise<DecorationSet>;
export declare function lspDocumentHighlights(): Extension;
