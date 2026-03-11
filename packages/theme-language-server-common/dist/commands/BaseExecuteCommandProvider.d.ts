import { Connection } from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';
export declare abstract class BaseExecuteCommandProvider {
    protected documentManager: DocumentManager;
    protected diagnosticsManager: DiagnosticsManager;
    protected clientCapabilities: ClientCapabilities;
    protected connection: Connection;
    static command: string;
    abstract execute(...args: any[]): Promise<void>;
    constructor(documentManager: DocumentManager, diagnosticsManager: DiagnosticsManager, clientCapabilities: ClientCapabilities, connection: Connection);
}
