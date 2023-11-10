import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { LinkedEditingRangeParams } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseLinkedEditingRangesProvider } from '../BaseLinkedEditingRangesProvider';
import { getHtmlElementNameRanges } from '../../utils/htmlTagNames';

export class HtmlTagNameLinkedRangesProvider implements BaseLinkedEditingRangesProvider {
  constructor(public documentManager: DocumentManager) {}

  async linkedEditingRanges(
    node: LiquidHtmlNode | null,
    ancestors: LiquidHtmlNode[] | null,
    params: LinkedEditingRangeParams,
  ) {
    if (!node || !ancestors) return null;

    const textDocument = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!textDocument) return null;

    const ranges = getHtmlElementNameRanges(node, ancestors, params, textDocument);
    if (!ranges) return null;
    return {
      ranges,
      wordPattern: '[a-zA-Z0-9-_]+',
    };
  }
}
