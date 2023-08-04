import { Connection, ExecuteCommandParams } from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';
import { BaseExecuteCommandProvider } from './BaseExecuteCommandProvider';
import { ApplyFixesProvider, ApplySuggestionProvider, RunChecksProvider } from './providers';

export const Commands = [
  ApplyFixesProvider.command,
  ApplySuggestionProvider.command,
  RunChecksProvider.command,
] as const;

type Command = (typeof Commands)[number];

function isKnownCommand(command: string): command is Command {
  return Commands.includes(command as any);
}

export class ExecuteCommandProvider {
  private commands: { [k in Command]: BaseExecuteCommandProvider };

  constructor(
    documentManager: DocumentManager,
    diagnosticsManager: DiagnosticsManager,
    clientCapabilities: ClientCapabilities,
    runChecks: RunChecksProvider['runChecks'],
    connection: Connection,
  ) {
    this.commands = {
      [ApplyFixesProvider.command]: new ApplyFixesProvider(
        documentManager,
        diagnosticsManager,
        clientCapabilities,
        connection,
      ),
      [ApplySuggestionProvider.command]: new ApplySuggestionProvider(
        documentManager,
        diagnosticsManager,
        clientCapabilities,
        connection,
      ),
      [RunChecksProvider.command]: new RunChecksProvider(
        documentManager,
        diagnosticsManager,
        clientCapabilities,
        connection,
        runChecks,
      ),
    };
  }

  async execute(params: ExecuteCommandParams): Promise<void> {
    if (!isKnownCommand(params.command)) return;
    const provider = this.commands[params.command];
    const args = params.arguments ?? [];
    await provider.execute(...args);
  }
}
