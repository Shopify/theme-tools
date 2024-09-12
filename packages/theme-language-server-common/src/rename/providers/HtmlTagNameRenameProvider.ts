import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import {
  PrepareRenameParams,
  PrepareRenameResult,
  Range,
  RenameParams,
  TextDocumentEdit,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../documents';
import { getHtmlElementNameRanges } from '../../utils/htmlTagNames';
import { BaseRenameProvider } from '../BaseRenameProvider';

export class HtmlTagNameRenameProvider implements BaseRenameProvider {
  constructor(private documentManager: DocumentManager) {}

  async prepare(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: PrepareRenameParams,
  ): Promise<null | PrepareRenameResult> {
    const textDocument = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!textDocument || !node || !ancestors) return null;

    const ranges = getHtmlElementNameRanges(node, ancestors, params, textDocument);
    if (!ranges || !ranges[0]) return null;

    return {
      range: ranges[0],
      placeholder: textDocument.getText(ranges[0]),
    };
  }

  async rename(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: RenameParams,
  ): Promise<null | WorkspaceEdit> {
    const textDocument = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!textDocument || !node || !ancestors) return null;

    const ranges = getHtmlElementNameRanges(node, ancestors, params, textDocument);
    if (!ranges) return null;

    const textDocumentEdit = TextDocumentEdit.create(
      { uri: textDocument.uri, version: textDocument.version },
      toTextEdits(ranges, params.newName),
    );

    return {
      documentChanges: [textDocumentEdit],
    };
  }
}

function toTextEdits(ranges: Range[], newText: string): TextEdit[] {
  return ranges.map((range) => TextEdit.replace(range, newText));
}
