import { CodeAction, CodeActionParams, Command } from 'vscode-languageserver';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';
export declare const CodeActionKinds: ("quickfix" | "source.fixAll")[];
export declare class CodeActionsProvider {
    private providers;
    constructor(documentManager: DocumentManager, diagnosticsManager: DiagnosticsManager);
    codeActions(params: CodeActionParams): (Command | CodeAction)[];
}
