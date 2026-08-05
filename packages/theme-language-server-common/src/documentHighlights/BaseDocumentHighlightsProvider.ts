import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { DocumentHighlight, DocumentHighlightParams } from 'vscode-languageserver';

export interface BaseDocumentHighlightsProvider {
  documentHighlights: (
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: DocumentHighlightParams,
  ) => Promise<DocumentHighlight[] | null>;
}
