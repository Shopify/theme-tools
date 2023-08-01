import { Connection } from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';

export abstract class BaseExecuteCommandProvider {
  static command: string;
  abstract execute(...args: any[]): Promise<void>;
  constructor(
    protected documentManager: DocumentManager,
    protected diagnosticsManager: DiagnosticsManager,
    protected clientCapabilities: ClientCapabilities,
    protected connection: Connection,
  ) {}
}
