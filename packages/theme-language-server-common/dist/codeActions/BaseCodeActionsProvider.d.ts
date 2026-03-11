import { CodeAction, CodeActionKind, CodeActionParams, Command } from 'vscode-languageserver';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';
export declare abstract class BaseCodeActionsProvider {
    protected documentManager: DocumentManager;
    protected diagnosticsManager: DiagnosticsManager;
    static kind: CodeActionKind;
    constructor(documentManager: DocumentManager, diagnosticsManager: DiagnosticsManager);
    get kind(): string;
    abstract codeActions(params: CodeActionParams): (Command | CodeAction)[];
}
