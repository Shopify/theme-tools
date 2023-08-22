import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { HtmlData, renderHtmlEntry } from '../../docset';
import { getCompoundName, isNamedHtmlElementNode } from '../../utils';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class HtmlTagHoverProvider implements BaseHoverProvider {
  async hover(
    _params: HoverParams,
    currentNode: LiquidHtmlNode,
    _ancestors: LiquidHtmlNode[],
  ): Promise<Hover | null> {
    if (!isNamedHtmlElementNode(currentNode)) {
      return null;
    }

    const name = getCompoundName(currentNode);

    if (!name || name === 'unknown') {
      return null;
    }

    const entry = HtmlData.tags.find((tag) => tag.name === name);

    if (!entry) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: renderHtmlEntry(entry),
      },
    };
  }
}
