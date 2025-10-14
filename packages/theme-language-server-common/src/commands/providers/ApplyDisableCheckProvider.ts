import { SourceCodeType, findCurrentNode, LiquidHtmlNode } from '@shopify/theme-check-common';
import { NodeTypes, LiquidTag } from '@shopify/liquid-html-parser';
import {
  ApplyWorkspaceEditRequest,
  Command,
  TextDocumentEdit,
  TextEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseExecuteCommandProvider } from '../BaseExecuteCommandProvider';
import { AugmentedLiquidSourceCode } from '../../documents/types';

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
      this.connection.console.warn('Disable check comments are only supported in Liquid files');
      return;
    }

    const { textDocument } = document;

    const isInLiquidTag = this.isInLiquidTagContext(document, lineNumber);
    const disableComment = this.getDisableComment(checkName, type, isInLiquidTag);
    let textEdit: TextEdit;

    switch (type) {
      case 'next-line': {
        let existingCommentLine = -1;

        for (let i = lineNumber - 1; i >= 0; i--) {
          const line = textDocument.getText({
            start: { line: i, character: 0 },
            end: { line: i + 1, character: 0 },
          });

          if (this.hasDisableComment(line, 'next-line', isInLiquidTag)) {
            existingCommentLine = i;
            break;
          }

          if (line.trim() !== '' && !line.includes('theme-check-disable')) {
            break;
          }
        }

        if (existingCommentLine >= 0) {
          textEdit = this.appendCheckToComment(
            textDocument,
            existingCommentLine,
            checkName,
            'next-line',
            isInLiquidTag,
          );
        } else {
          const lineText = textDocument.getText({
            start: { line: lineNumber, character: 0 },
            end: { line: lineNumber + 1, character: 0 },
          });
          const indent = lineText.match(/^\s*/)?.[0] || '';
          textEdit = TextEdit.insert(
            { line: lineNumber, character: 0 },
            `${indent}${disableComment}\n`,
          );
        }
        break;
      }
      case 'file': {
        let existingCommentLine = -1;

        for (let i = 0; i < textDocument.lineCount; i++) {
          const line = textDocument.getText({
            start: { line: i, character: 0 },
            end: { line: i + 1, character: 0 },
          });
          if (this.hasDisableComment(line, 'file', false)) {
            existingCommentLine = i;
            break;
          }
          if (line.trim() !== '' && !line.includes('theme-check-disable')) {
            break;
          }
        }

        if (existingCommentLine >= 0) {
          textEdit = this.appendCheckToComment(
            textDocument,
            existingCommentLine,
            checkName,
            'file',
            false,
          );
        } else {
          const fileComment = this.getDisableComment(checkName, type, false);
          textEdit = TextEdit.insert({ line: 0, character: 0 }, `${fileComment}\n`);
        }
        break;
      }
    }

    const textDocumentEdit = TextDocumentEdit.create(
      { uri: textDocument.uri, version: textDocument.version },
      [textEdit],
    );

    await this.connection.sendRequest(ApplyWorkspaceEditRequest.type, {
      edit: {
        documentChanges: [textDocumentEdit],
      },
    });
  }

  private getDisableComment(
    checkName: string,
    type: 'next-line' | 'file',
    isInLiquidTag: boolean,
  ): string {
    const comment = this.getDisableCommentGeneral(checkName, type);
    return isInLiquidTag ? `${comment}` : `{% ${comment} %}`;
  }

  private getDisableCommentGeneral(checkName: string, type: 'next-line' | 'file'): string {
    return type === 'next-line'
      ? `# theme-check-disable-next-line ${checkName}`
      : `# theme-check-disable ${checkName}`;
  }

  private isInLiquidTagContext(document: AugmentedLiquidSourceCode, lineNumber: number): boolean {
    if (!document.ast || document.ast instanceof Error) {
      return false;
    }

    const offset = document.textDocument.offsetAt({ line: lineNumber, character: 0 });
    const [currentNode, ancestors] = findCurrentNode(document.ast, offset);

    const allNodes = currentNode ? [currentNode, ...ancestors] : ancestors;
    return allNodes.some(this.isLiquidTag);
  }

  private isLiquidTag(node: LiquidHtmlNode | undefined): node is LiquidTag & { name: 'liquid' } {
    if (!node) return false;
    return node.type === NodeTypes.LiquidTag && node.name === 'liquid';
  }

  private hasDisableComment(
    line: string,
    type: 'next-line' | 'file',
    isInLiquidTag: boolean,
  ): boolean {
    const trimmed = line.trim();
    if (isInLiquidTag) {
      return type === 'next-line'
        ? trimmed.startsWith('# theme-check-disable-next-line')
        : trimmed.startsWith('# theme-check-disable') && !trimmed.includes('disable-next-line');
    }
    return type === 'next-line'
      ? trimmed.startsWith('{% # theme-check-disable-next-line') && trimmed.endsWith('%}')
      : trimmed.startsWith('{% # theme-check-disable') &&
          !trimmed.includes('disable-next-line') &&
          trimmed.endsWith('%}');
  }

  private appendCheckToComment(
    textDocument: TextDocument,
    lineNumber: number,
    checkName: string,
    type: 'next-line' | 'file',
    isInLiquidTag: boolean,
  ): TextEdit {
    const line = textDocument.getText({
      start: { line: lineNumber, character: 0 },
      end: { line: lineNumber + 1, character: 0 },
    });
    const trimmedLine = line.replace(/\n$/, '');

    const indent = line.match(/^\s*/)?.[0] || '';
    const commentStartChar = indent.length;

    const checksPattern = isInLiquidTag
      ? type === 'next-line'
        ? /# theme-check-disable-next-line (.+)$/
        : /# theme-check-disable (.+)$/
      : type === 'next-line'
      ? /{% # theme-check-disable-next-line (.+) %}$/
      : /{% # theme-check-disable (.+) %}$/;

    const match = trimmedLine.match(checksPattern);
    if (!match) {
      const comment = this.getDisableComment(checkName, type, isInLiquidTag);
      return TextEdit.insert({ line: lineNumber, character: 0 }, `${indent}${comment}\n`);
    }

    const checksList = match[1];
    const checks = checksList.split(',').map((c) => c.trim());

    checks.push(checkName);

    const updatedChecks = checks.join(', ');
    const commentContent = trimmedLine.substring(commentStartChar);
    const updatedComment = commentContent.replace(checksList, updatedChecks);

    return TextEdit.replace(
      {
        start: { line: lineNumber, character: commentStartChar },
        end: { line: lineNumber, character: trimmedLine.length },
      },
      updatedComment,
    );
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
