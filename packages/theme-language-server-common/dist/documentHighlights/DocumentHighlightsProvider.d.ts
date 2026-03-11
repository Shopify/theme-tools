import { DocumentHighlight, DocumentHighlightParams } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
/**
 * The default behaviour for documentHighlights is to highlight every occurence
 * of the word under the cursor. We want to prevent that since it doesn't really
 * make sense in our context. We don't want to highlight every occurence of
 * `assign` when you put your cursor over it.
 */
export declare const PREVENT_DEFAULT: DocumentHighlight[];
/**
 * Informs the client to highlight ranges in a document.
 *
 * This is a pretty abstract concept, but you could use it to highlight all
 * instances of a variable in a template, to highlight the matching
 * opening/closing liquid tags, html tags, etc.
 */
export declare class DocumentHighlightsProvider {
    documentManager: DocumentManager;
    private providers;
    constructor(documentManager: DocumentManager);
    documentHighlights(params: DocumentHighlightParams): Promise<DocumentHighlight[] | null>;
}
