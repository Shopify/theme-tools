import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { HtmlData, renderHtmlEntry } from '../../docset';
import { isNamedHtmlElementNode, isTextNode } from '../../utils';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class HtmlTagHoverProvider implements BaseHoverProvider {
  async hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null> {
    let name: string | undefined;
    const parentNode = ancestors.at(-1);

    if (isNamedHtmlElementNode(currentNode) && typeof currentNode.name === 'string') {
      name = currentNode.name;
    } else if (
      isTextNode(currentNode) &&
      parentNode &&
      isNamedHtmlElementNode(parentNode) &&
      typeof parentNode.name !== 'string' &&
      parentNode.name.includes(currentNode) &&
      parentNode.name.length === 1
    ) {
      name = currentNode.value;
    }

    if (!name) {
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
