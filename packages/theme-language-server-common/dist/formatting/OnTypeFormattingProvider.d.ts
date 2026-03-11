import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { SetCursorPosition } from './types';
export declare class OnTypeFormattingProvider {
    documentManager: DocumentManager;
    setCursorPosition: SetCursorPosition;
    private providers;
    constructor(documentManager: DocumentManager, setCursorPosition?: SetCursorPosition);
    onTypeFormatting(params: DocumentOnTypeFormattingParams): Promise<import("vscode-languageserver").TextEdit[] | null>;
}
