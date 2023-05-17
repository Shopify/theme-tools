import { Connection } from 'vscode-languageserver';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';

export abstract class BaseExecuteCommandProvider {
  static command: string;
  abstract execute(...args: any[]): Promise<void>;
  constructor(
    protected documentManager: DocumentManager,
    protected diagnosticsManager: DiagnosticsManager,
    protected connection: Connection,
  ) {}
}
