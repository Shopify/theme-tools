import { SourceCodeType } from '@shopify/theme-check-common';
import { DocumentHighlight, DocumentHighlightParams } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { findCurrentNode } from '../visitor';
import { BaseDocumentHighlightsProvider } from './BaseDocumentHighlightsProvider';
import {
  HtmlTagNameDocumentHighlightsProvider,
  LiquidBlockTagDocumentHighlightsProvider,
} from './providers';

/**
 * The default behaviour for documentHighlights is to highlight every occurence
 * of the word under the cursor. We want to prevent that since it doesn't really
 * make sense in our context. We don't want to highlight every occurence of
 * `assign` when you put your cursor over it.
 */
export const PREVENT_DEFAULT: DocumentHighlight[] = [];

/**
 * Informs the client to highlight ranges in a document.
 *
 * This is a pretty abstract concept, but you could use it to highlight all
 * instances of a variable in a template, to highlight the matching
 * opening/closing liquid tags, html tags, etc.
 */
export class DocumentHighlightsProvider {
  private providers: BaseDocumentHighlightsProvider[];

  constructor(public documentManager: DocumentManager) {
    this.providers = [
      new HtmlTagNameDocumentHighlightsProvider(documentManager),
      new LiquidBlockTagDocumentHighlightsProvider(documentManager),
    ];
  }

  async documentHighlights(params: DocumentHighlightParams): Promise<DocumentHighlight[] | null> {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document || document.type !== SourceCodeType.LiquidHtml || document.ast instanceof Error) {
      return PREVENT_DEFAULT;
    }

    const [currentNode, ancestors] = findCurrentNode(
      document.ast,
      document.textDocument.offsetAt(params.position),
    );

    const promises = this.providers.map((p) =>
      p.documentHighlights(currentNode, ancestors, params).catch(() => null),
    );
    const results = await Promise.all(promises);

    return results.find(Boolean) ?? PREVENT_DEFAULT;
  }
}
