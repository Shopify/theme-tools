import { CodeAction, CodeActionParams, Command } from 'vscode-languageserver';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';
import { FixAllProvider, FixProvider, SuggestionProvider, DisableCheckProvider } from './providers';
import { BaseCodeActionsProvider } from './BaseCodeActionsProvider';

export const CodeActionKinds = Array.from(
  new Set([
    DisableCheckProvider.kind,
    FixAllProvider.kind,
    FixProvider.kind,
    SuggestionProvider.kind,
  ]),
);

export class CodeActionsProvider {
  private providers: BaseCodeActionsProvider[];

  constructor(documentManager: DocumentManager, diagnosticsManager: DiagnosticsManager) {
    this.providers = [
      new DisableCheckProvider(documentManager, diagnosticsManager),
      new FixAllProvider(documentManager, diagnosticsManager),
      new FixProvider(documentManager, diagnosticsManager),
      new SuggestionProvider(documentManager, diagnosticsManager),
    ];
  }

  codeActions(params: CodeActionParams): (Command | CodeAction)[] {
    const only = params.context.only;
    return this.providers
      .filter((provider) => !only || only.some((kind) => provider.kind.startsWith(kind)))
      .flatMap((provider) => provider.codeActions(params));
  }
}
