import { CodeAction, CodeActionKind, CodeActionParams, Command } from 'vscode-languageserver';
import { SourceCodeType, findCurrentNode } from '@shopify/theme-check-common';
import { LiquidRawTag, NodeTypes } from '@shopify/liquid-html-parser';
import { applyDisableCheckCommand } from '../../commands/providers';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';
import { isInRange, toCodeAction } from './utils';
import { Anomaly } from '../../diagnostics/DiagnosticsManager';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class DisableCheckProvider extends BaseCodeActionsProvider {
  static kind = CodeActionKind.QuickFix;

  codeActions(params: CodeActionParams): (Command | CodeAction)[] {
    const { uri } = params.textDocument;
    const document = this.documentManager.get(uri);
    const diagnostics = this.diagnosticsManager.get(uri);
    if (!document || !diagnostics) return [];

    if (document.type !== SourceCodeType.LiquidHtml) return [];

    const { textDocument } = document;
    const { anomalies, version } = diagnostics;
    const start = textDocument.offsetAt(params.range.start);
    const end = textDocument.offsetAt(params.range.end);

    // Don't show disable actions inside stylesheet/javascript tags
    if (document.ast && !(document.ast instanceof Error)) {
      const [, ancestors] = findCurrentNode(document.ast, start);
      const isInsideRestrictedTag = ancestors.some(
        (node): node is LiquidRawTag =>
          node.type === NodeTypes.LiquidRawTag &&
          (node.name === 'stylesheet' || node.name === 'javascript'),
      );
      if (isInsideRestrictedTag) return [];
    }

    const anomaliesUnderCursor = anomalies.filter((anomaly) => isInRange(anomaly, start, end));
    if (anomaliesUnderCursor.length === 0) return [];

    return [
      ...disableNextLineCursorActions(uri, version, anomaliesUnderCursor, textDocument),
      ...disableEntireFileActions(uri, version, anomaliesUnderCursor),
    ];
  }
}

/**
 * @returns code actions to disable only one of the offenses under the cursor
 * @example Disable ParserBlockingScript for this line
 */
function disableNextLineCursorActions(
  uri: string,
  version: number | undefined,
  anomaliesUnderCursor: Anomaly[],
  textDocument: TextDocument,
): CodeAction[] {
  // Group by check name to avoid duplicate disable actions for the same check on the same line
  const checksByLine = new Map<string, Anomaly>();

  anomaliesUnderCursor.forEach((anomaly) => {
    const key = `${anomaly.offense.check}-${
      textDocument.positionAt(anomaly.offense.start.index).line
    }`;
    if (!checksByLine.has(key)) {
      checksByLine.set(key, anomaly);
    }
  });

  return Array.from(checksByLine.values()).map(({ offense, diagnostic }) => {
    const position = textDocument.positionAt(offense.start.index);
    return toCodeAction(
      `Disable ${offense.check} for this line`,
      applyDisableCheckCommand(uri, version, 'next-line', offense.check, position.line),
      [diagnostic],
      DisableCheckProvider.kind,
    );
  });
}

/**
 * @returns code actions to disable all offenses of a particular type
 * @example Disable ParserBlockingScript for entire file
 */
function disableEntireFileActions(
  uri: string,
  version: number | undefined,
  anomaliesUnderCursor: Anomaly[],
): CodeAction[] {
  // Group by check name to avoid duplicate disable actions for the same check
  const checks = new Set(anomaliesUnderCursor.map((anomaly) => anomaly.offense.check));

  return Array.from(checks).map((check) => {
    const checkAnomalies = anomaliesUnderCursor.filter(({ offense }) => offense.check === check);
    const diagnostics = checkAnomalies.map((a) => a.diagnostic);

    return toCodeAction(
      `Disable ${check} for entire file`,
      applyDisableCheckCommand(uri, version, 'file', check, 0), // lineNumber 0 for file-level
      diagnostics,
      DisableCheckProvider.kind,
    );
  });
}
