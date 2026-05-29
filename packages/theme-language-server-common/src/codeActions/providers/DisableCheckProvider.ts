import { Offense, SourceCodeType, findCurrentNode, isError } from '@shopify/theme-check-common';
import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
  Diagnostic,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';
import { isInRange, toEditCodeAction } from './utils';

export class DisableCheckProvider extends BaseCodeActionsProvider {
  static kind = CodeActionKind.QuickFix;

  codeActions(params: CodeActionParams): (Command | CodeAction)[] {
    const { uri } = params.textDocument;
    const document = this.documentManager.get(uri);
    const diagnostics = this.diagnosticsManager.get(uri);
    if (!document || !diagnostics || document.type !== SourceCodeType.LiquidHtml) return [];

    const { textDocument } = document;
    const { anomalies } = diagnostics;
    const start = textDocument.offsetAt(params.range.start);
    const end = textDocument.offsetAt(params.range.end);

    const anomaliesUnderCursor = anomalies.filter((anomaly) => isInRange(anomaly, start, end));
    if (anomaliesUnderCursor.length === 0) return [];

    const byCheck = new Map<string, { offense: Offense; diagnostics: Diagnostic[] }>();
    for (const { offense, diagnostic } of anomaliesUnderCursor) {
      const existing = byCheck.get(offense.check);
      if (existing) {
        existing.diagnostics.push(diagnostic);
      } else {
        byCheck.set(offense.check, { offense, diagnostics: [diagnostic] });
      }
    }

    const actions: CodeAction[] = [];
    for (const [check, { offense, diagnostics: groupDiagnostics }] of byCheck) {
      if (!isInsideLiquidTag(document.ast, offense.start.index)) {
        actions.push(
          toEditCodeAction(
            `Disable ${check} for this line`,
            disableNextLineEdit(uri, textDocument, offense.start.line, check),
            groupDiagnostics,
            DisableCheckProvider.kind,
          ),
        );
      }
      actions.push(
        toEditCodeAction(
          `Disable ${check} for entire file`,
          disableFileEdit(uri, check),
          groupDiagnostics,
          DisableCheckProvider.kind,
        ),
      );
    }

    return actions;
  }
}

function disableFileEdit(uri: string, check: string): WorkspaceEdit {
  const newText = `{% # theme-check-disable ${check} %}\n`;
  return { changes: { [uri]: [TextEdit.insert({ line: 0, character: 0 }, newText)] } };
}

function disableNextLineEdit(
  uri: string,
  textDocument: TextDocument,
  line: number,
  check: string,
): WorkspaceEdit {
  const lineText = textDocument.getText({
    start: { line, character: 0 },
    end: { line: line + 1, character: 0 },
  });
  const indent = lineText.match(/^[ \t]*/)?.[0] ?? '';
  const newText = `${indent}{% # theme-check-disable-next-line ${check} %}\n`;
  return { changes: { [uri]: [TextEdit.insert({ line, character: 0 }, newText)] } };
}

function isInsideLiquidTag(ast: LiquidHtmlNode | Error, index: number): boolean {
  if (isError(ast)) return false;
  const [currentNode, ancestors] = findCurrentNode(ast, index);
  return [currentNode, ...ancestors].some(
    (node) => node.type === NodeTypes.LiquidTag && node.name === 'liquid',
  );
}
