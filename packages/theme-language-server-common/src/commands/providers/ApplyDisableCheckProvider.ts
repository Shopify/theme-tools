import {
  createCorrector,
  Fix,
  FixDescription,
  flattenFixes,
  SourceCodeType,
} from '@shopify/theme-check-common';
import {
  ApplyWorkspaceEditRequest,
  Command,
  TextDocumentEdit,
  TextEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseExecuteCommandProvider } from '../BaseExecuteCommandProvider';

export class ApplyDisableCheckProvider extends BaseExecuteCommandProvider {
  static command = 'themeCheck/applyDisableCheck' as const;

  async execute(
    uri: string,
    version: number | undefined,
    type: 'next-line' | 'file',
    checkName: string,
    lineNumber: number,
  ) {
    const document = this.documentManager.get(uri);
    const diagnostics = this.diagnosticsManager.get(uri);
    if (!document || !diagnostics) return;
    if (document.version !== version || diagnostics.version !== version) return;

    if (!this.clientCapabilities.hasApplyEditSupport) return;

    if (document.type !== SourceCodeType.LiquidHtml) {
      console.warn('Disable check comments are only supported in Liquid files');
      return;
    }

    const { textDocument } = document;
    const corrector = createCorrector(document.type, document.source);

    const disableComment = this.getDisableComment(checkName, type);

    switch (type) {
      case 'next-line': {
        const lineStart = textDocument.offsetAt({ line: lineNumber, character: 0 });
        const lineText = textDocument.getText({
          start: { line: lineNumber, character: 0 },
          end: { line: lineNumber + 1, character: 0 },
        });
        const indent = lineText.match(/^\s*/)?.[0] || '';

        corrector.insert(lineStart, `${indent}${disableComment}\n`);
        break;
      }
      case 'file': {
        corrector.insert(0, `${disableComment}\n`);
        break;
      }
    }

    const textDocumentEdit = TextDocumentEdit.create(
      { uri: textDocument.uri, version: textDocument.version },
      toTextEdits(textDocument, corrector.fix),
    );

    await this.connection.sendRequest(ApplyWorkspaceEditRequest.type, {
      edit: {
        documentChanges: [textDocumentEdit],
      },
    });
  }

  private getDisableComment(checkName: string, type: 'next-line' | 'file'): string {
    return type === 'next-line'
      ? `{% # theme-check-disable-next-line ${checkName} %}`
      : `{% # theme-check-disable ${checkName} %}`;
  }
}

export function applyDisableCheckCommand(
  uri: string,
  version: number | undefined,
  type: 'next-line' | 'file',
  checkName: string,
  lineNumber: number,
): Command {
  return Command.create(
    type === 'next-line'
      ? `Disable ${checkName} for this line`
      : `Disable ${checkName} for entire file`,
    ApplyDisableCheckProvider.command,
    uri,
    version,
    type,
    checkName,
    lineNumber,
  );
}

function toTextEdit(document: TextDocument, fixDesc: FixDescription): TextEdit {
  return {
    newText: fixDesc.insert,
    range: {
      start: document.positionAt(fixDesc.startIndex),
      end: document.positionAt(fixDesc.endIndex),
    },
  };
}

function toTextEdits(document: TextDocument, fix: Fix): TextEdit[] {
  return flattenFixes(fix).map((fixDesc) => toTextEdit(document, fixDesc));
}
