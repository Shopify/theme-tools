import { LiquidHtmlNode, SourceCodeType } from '@shopify/theme-check-common';
import { LinkedEditingRangeParams, LinkedEditingRanges } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { findCurrentNode } from '../visitor';
import { BaseLinkedEditingRangesProvider } from './BaseLinkedEditingRangesProvider';
import { EmptyHtmlTagLinkedRangesProvider, HtmlTagNameLinkedRangesProvider } from './providers';

export class LinkedEditingRangesProvider {
  private providers: BaseLinkedEditingRangesProvider[];

  constructor(public documentManager: DocumentManager) {
    this.providers = [
      new HtmlTagNameLinkedRangesProvider(documentManager),
      new EmptyHtmlTagLinkedRangesProvider(documentManager),
    ];
  }

  async linkedEditingRanges(params: LinkedEditingRangeParams): Promise<LinkedEditingRanges | null> {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document || document.type !== SourceCodeType.LiquidHtml) {
      return null;
    }

    let currentNode: LiquidHtmlNode | null = null;
    let ancestors: LiquidHtmlNode[] | null = null;

    if (!(document.ast instanceof Error)) {
      [currentNode, ancestors] = findCurrentNode(
        document.ast,
        document.textDocument.offsetAt(params.position),
      );
    }

    const promises = this.providers.map((p) =>
      p.linkedEditingRanges(currentNode, ancestors, params).catch(() => null),
    );
    const results = await Promise.all(promises);
    return results.find(Boolean) ?? null;
  }
}
