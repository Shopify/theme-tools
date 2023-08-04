import { CodeAction, CodeActionKind, CodeActionParams, Command } from 'vscode-languageserver';
import { applyFixCommand } from '../../commands';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';
import { FixableAnomaly, isFixable, toCodeAction } from './utils';

/**
 * FixAllProvider is a `source.fixAll` code action provider.
 *
 * It is different from FixProvider in the sense where this won't appear on
 * top of diagnostics, but rather can be executed in different contexts.
 * Unlike FixProvider, it is also cursor position independent.
 *
 * Folks can have this run automatically on save with the following config:
 *
 * "[liquid]": {
 *   "editor.codeActionsOnSave": {
 *     "source.fixAll": true,
 *   }
 * },
 *
 * Or as as 'Right click > Source Actions...' request
 */
export class FixAllProvider extends BaseCodeActionsProvider {
  static kind = CodeActionKind.SourceFixAll;

  codeActions(params: CodeActionParams): (Command | CodeAction)[] {
    const { uri } = params.textDocument;
    const document = this.documentManager.get(uri);
    const diagnostics = this.diagnosticsManager.get(uri);
    if (!document || !diagnostics) return [];

    const { anomalies, version } = diagnostics;
    const fixableAnomalies = anomalies.filter(isFixable);
    if (fixableAnomalies.length === 0) return [];

    return quickfixAllAction(uri, version, fixableAnomalies);
  }
}

/**
 * @returns code action to fix all offenses in a file
 * @example Fix all auto-fixable problems
 */
function quickfixAllAction(
  uri: string,
  version: number | undefined,
  fixableAnomalies: FixableAnomaly[],
): CodeAction[] {
  const ids = fixableAnomalies.map((a) => a.id);
  const diagnostics = fixableAnomalies.map((a) => a.diagnostic);

  return [
    toCodeAction(
      `Fix all auto-fixable problems`,
      applyFixCommand(uri, version, ids),
      diagnostics,
      FixAllProvider.kind,
    ),
  ];
}
