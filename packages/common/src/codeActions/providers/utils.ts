import {
  CodeAction,
  CodeActionKind,
  Command,
  Diagnostic,
} from 'vscode-languageserver';
import { Anomaly } from '../../diagnostics';

// They have an awkard API for creating them, so we have this helper here
// to make it a bit more straightforward.
export function toCodeAction(
  title: string,
  command: Command,
  diagnostics: Diagnostic[],
  kind: CodeActionKind,
  isPreferred: boolean = false,
): CodeAction {
  const codeAction = CodeAction.create(title, command, kind);
  codeAction.diagnostics = diagnostics;
  codeAction.isPreferred = isPreferred;
  return codeAction;
}

/**
 * The range is either the selection or cursor position, an offense is in
 * range if the selection and offense overlap in any way.
 */
export function isInRange({ offense }: Anomaly, start: number, end: number) {
  const offenseStart = offense.start.index;
  const offenseEnd = offense.end.index;
  const isOutOfRange = offenseEnd < start || offenseStart > end;
  return !isOutOfRange;
}
