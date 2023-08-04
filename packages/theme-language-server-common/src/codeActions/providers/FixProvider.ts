import { CodeAction, CodeActionKind, CodeActionParams, Command } from 'vscode-languageserver';
import { applyFixCommand } from '../../commands';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';
import { FixableAnomaly, isFixable, isInRange, toCodeAction } from './utils';

export class FixProvider extends BaseCodeActionsProvider {
  static kind = CodeActionKind.QuickFix;

  codeActions(params: CodeActionParams): (Command | CodeAction)[] {
    const { uri } = params.textDocument;
    const document = this.documentManager.get(uri);
    const diagnostics = this.diagnosticsManager.get(uri);
    if (!document || !diagnostics) return [];

    const { textDocument } = document;
    const { anomalies, version } = diagnostics;
    const start = textDocument.offsetAt(params.range.start);
    const end = textDocument.offsetAt(params.range.end);

    const fixableAnomalies = anomalies.filter(isFixable);
    const anomaliesUnderCursor = fixableAnomalies.filter((anomaly) =>
      isInRange(anomaly, start, end),
    );
    if (anomaliesUnderCursor.length === 0) return [];

    return [
      ...quickfixCursorActions(uri, version, anomaliesUnderCursor),
      ...quickfixSameTypeActions(uri, version, anomaliesUnderCursor, fixableAnomalies),
      ...quickfixAllAction(uri, version, fixableAnomalies),
    ];
  }
}

/**
 * @returns code actions to fix only one of the offenses under the cursor
 * @example Fix this ParserBlockingScript problem: '...'
 */
function quickfixCursorActions(
  uri: string,
  version: number | undefined,
  anomaliesUnderCursor: FixableAnomaly[],
): CodeAction[] {
  return anomaliesUnderCursor.map(({ offense, diagnostic, id }) => {
    return toCodeAction(
      `Fix this ${offense.check} problem: ${offense.message}`,
      applyFixCommand(uri, version, [id]),
      [diagnostic],
      FixProvider.kind,
      true,
    );
  });
}

/**
 * @returns code actions to fix all offenses of a particular type
 * @example Fix all ParserBlockingScript problems
 */
function quickfixSameTypeActions(
  uri: string,
  version: number | undefined,
  anomaliesUnderCursor: FixableAnomaly[],
  fixableAnomalies: FixableAnomaly[],
): CodeAction[] {
  const checks = new Set(anomaliesUnderCursor.map((anomaly) => anomaly.offense.check));
  return Array.from(checks).flatMap((check) => {
    const checkAnomalies = fixableAnomalies.filter(({ offense }) => offense.check === check);

    // We don't want to show this one if there's only one of this type.
    if (checkAnomalies.length < 2) return [];
    const ids = checkAnomalies.map((a) => a.id);
    const diagnostics = checkAnomalies.map((a) => a.diagnostic);
    return toCodeAction(
      `Fix all ${check} problems`,
      applyFixCommand(uri, version, ids),
      diagnostics,
      FixProvider.kind,
    );
  });
}

/**
 * @returns code action to fix all offenses of a particular type
 * @example Fix all auto-fixable problems
 */
function quickfixAllAction(
  uri: string,
  version: number | undefined,
  fixableAnomalies: FixableAnomaly[],
): CodeAction[] {
  const ids = fixableAnomalies.map((a) => a.id);
  const diagnostics = fixableAnomalies.map((a) => a.diagnostic);
  const checks = new Set(diagnostics.map((a) => a.code));

  // We don't want to this one if there's only one type of problems
  if (checks.size < 2) return [];

  return [
    toCodeAction(
      `Fix all auto-fixable problems`,
      applyFixCommand(uri, version, ids),
      diagnostics,
      FixProvider.kind,
    ),
  ];
}
