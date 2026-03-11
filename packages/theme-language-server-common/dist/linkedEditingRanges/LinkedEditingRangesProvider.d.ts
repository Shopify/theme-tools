import { LinkedEditingRangeParams, LinkedEditingRanges } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
export declare class LinkedEditingRangesProvider {
    documentManager: DocumentManager;
    private providers;
    constructor(documentManager: DocumentManager);
    linkedEditingRanges(params: LinkedEditingRangeParams): Promise<LinkedEditingRanges | null>;
}
