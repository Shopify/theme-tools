import { CodeAction, CodeActionParams, Command } from 'vscode-languageserver';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';
import { FixProvider } from './providers';
import { BaseCodeActionsProvider } from './BaseCodeActionsProvider';

export class CodeActionsProvider {
  private providers: BaseCodeActionsProvider[];

  constructor(
    documentManager: DocumentManager,
    diagnosticsManager: DiagnosticsManager,
  ) {
    this.providers = [
      new FixProvider(documentManager, diagnosticsManager),
      // new SuggestionProvider()
    ];
  }

  codeActions(params: CodeActionParams): (Command | CodeAction)[] {
    return this.providers.flatMap((provider) => provider.codeActions(params));
  }
}
