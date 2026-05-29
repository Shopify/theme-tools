import { SourceCodeType } from '@shopify/theme-check-common';
import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
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

    const { offense, diagnostic } = anomaliesUnderCursor[0];
    const check = offense.check;

    return [
      toEditCodeAction(
        `Disable ${check} for this line`,
        disableNextLineEdit(uri, textDocument, offense.start.line, check),
        [diagnostic],
        DisableCheckProvider.kind,
      ),
    ];
  }
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
