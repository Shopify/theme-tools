import { Connection, ExecuteCommandParams } from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';
import { RunChecksProvider } from './providers';
export declare const Commands: readonly ["themeCheck/applyFixes", "themeCheck/applySuggestion", "themeCheck/runChecks"];
export declare class ExecuteCommandProvider {
    private commands;
    constructor(documentManager: DocumentManager, diagnosticsManager: DiagnosticsManager, clientCapabilities: ClientCapabilities, runChecks: RunChecksProvider['runChecks'], connection: Connection);
    execute(params: ExecuteCommandParams): Promise<void>;
}
