import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { DocumentHighlightParams } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseDocumentHighlightsProvider } from '../BaseDocumentHighlightsProvider';
import { getHtmlElementNameRanges } from '../../utils/htmlTagNames';

export class HtmlTagNameDocumentHighlightsProvider implements BaseDocumentHighlightsProvider {
  constructor(public documentManager: DocumentManager) {}

  async documentHighlights(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: DocumentHighlightParams,
  ) {
    const textDocument = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!textDocument) return null;

    const ranges = getHtmlElementNameRanges(node, ancestors, params, textDocument);
    if (!ranges) return null;
    return ranges.map((range) => ({ range }));
  }
}
