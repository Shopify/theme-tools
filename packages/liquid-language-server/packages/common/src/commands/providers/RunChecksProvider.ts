import { Connection } from 'vscode-languageserver';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DiagnosticsManager, makeRunChecks } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { DebouncedFunction } from '../../utils';
import { BaseExecuteCommandProvider } from '../BaseExecuteCommandProvider';

/**
 * The RunChecksProvider runs theme check on all open files.
 *
 * It is triggered by the cmd+p command in the VS Code extension and is
 * otherwise not used internally, which is why there is no
 * `runChecksCommand` method.
 *
 * This will be useful in a world where `checkOnSave`, `checkOnChange`,
 * `checkOnOpen` are all false.
 */
export class RunChecksProvider extends BaseExecuteCommandProvider {
  static command = 'themeCheck/runChecks' as const;

  constructor(
    protected documentManager: DocumentManager,
    protected diagnosticsManager: DiagnosticsManager,
    protected clientCapabilities: ClientCapabilities,
    protected connection: Connection,
    private runChecks: DebouncedFunction<ReturnType<typeof makeRunChecks>>,
  ) {
    super(documentManager, diagnosticsManager, clientCapabilities, connection);
  }

  async execute() {
    const openDocuments = this.documentManager.openDocuments;
    const triggerURIs = openDocuments.map((sourceCode) => sourceCode.uri);
    this.runChecks(triggerURIs);
  }
}
