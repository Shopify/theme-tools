import {
  Offense,
  SourceCodeType,
  WithRequired,
} from '@shopify/theme-check-common';
import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
  Diagnostic,
} from 'vscode-languageserver';
import { applyFixCommand } from '../../commands';
import { Anomaly, DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';

export class FixProvider implements BaseCodeActionsProvider {
  constructor(
    private documentManager: DocumentManager,
    private diagnosticsManager: DiagnosticsManager,
  ) {}

  kind = CodeActionKind.QuickFix;

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
      ...quickfixSameTypeActions(
        uri,
        version,
        anomaliesUnderCursor,
        fixableAnomalies,
      ),
      ...quickfixAllAction(uri, version, fixableAnomalies),
    ];
  }
}

// I might want to fix all in a particular file
// uri, version, SuggestionId[]
//
// const diagnostics = this.diagnosticsManager.get(uri)
// const document = this.documentManager.get(uri)
// if (!document || !diagnostics || diagnostics.version !== version) return
//
// const suggestions = suggestionIds
//  .map(([anomalyId, suggestId]) => diagnostics.anomalies[anomalyId].offense.suggest[suggestId])
//
// const corrector = createCorrector(type, document.source);
//
// for (const collectFixes of suggestions) {
//   collectFixes(corrector);
// }
//
// const edits = applyFix(source, corrector.fix);
function applySuggestionCommand(): Command {
  return Command.create('applySuggestions', 'themeCheck/applySuggestions', []);
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
  const checks = new Set(
    anomaliesUnderCursor.map((anomaly) => anomaly.offense.check),
  );
  return Array.from(checks).flatMap((check) => {
    const checkAnomalies = fixableAnomalies.filter(
      ({ offense }) => offense.check === check,
    );

    // We don't want to show this one if there's only one of this type.
    if (checkAnomalies.length < 2) return [];
    const ids = checkAnomalies.map((a) => a.id);
    const diagnostics = checkAnomalies.map((a) => a.diagnostic);
    return toCodeAction(
      `Fix all ${check} problems`,
      applyFixCommand(uri, version, ids),
      diagnostics,
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
    ),
  ];
}

/**
 * An anomaly is fixable if the offense has the `fix` attribute
 *
 * This type guarantees that Offense.fix is defined (and is thus fixable).
 */
type FixableAnomaly<S extends SourceCodeType = SourceCodeType> =
  S extends SourceCodeType
    ? {
        diagnostic: Diagnostic;
        offense: WithRequired<Offense<S>, 'fix'>;
        id: number;
      }
    : never;

function isFixable(anomaly: Anomaly): anomaly is FixableAnomaly {
  const { offense } = anomaly;
  return 'fix' in offense && offense.fix !== undefined;
}

/**
 * The range is either the selection or cursor position, an offense is in
 * range if the selection and offense overlap in any way.
 */
function isInRange({ offense }: Anomaly, start: number, end: number) {
  const offenseStart = offense.start.index;
  const offenseEnd = offense.end.index;
  const isOutOfRange = offenseEnd < start || offenseStart > end;
  return !isOutOfRange;
}

// They have an awkard API for creating them, so we have this helper here
// to make it a bit more straightforward.
function toCodeAction(
  title: string,
  command: Command,
  diagnostics: Diagnostic[],
  isPreferred: boolean = false,
): CodeAction {
  const codeAction = CodeAction.create(title, command, CodeActionKind.QuickFix);
  codeAction.diagnostics = diagnostics;
  codeAction.isPreferred = isPreferred;
  return codeAction;
}
