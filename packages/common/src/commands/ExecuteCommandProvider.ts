import { Connection, ExecuteCommandParams } from 'vscode-languageserver';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';
import { BaseExecuteCommandProvider } from './BaseExecuteCommandProvider';
import { ApplyFixesProvider, ApplySuggestionProvider } from './providers';

export const Commands = [
  ApplyFixesProvider.command,
  ApplySuggestionProvider.command,
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
    connection: Connection,
  ) {
    this.commands = {
      [ApplyFixesProvider.command]: new ApplyFixesProvider(
        documentManager,
        diagnosticsManager,
        connection,
      ),
      [ApplySuggestionProvider.command]: new ApplySuggestionProvider(
        documentManager,
        diagnosticsManager,
        connection,
      ),
    };
  }

  async execute(params: ExecuteCommandParams): Promise<void> {
    if (!isKnownCommand(params.command)) return;
    const provider = this.commands[params.command];
    await provider.execute(...(params.arguments as any[]));
  }
}
