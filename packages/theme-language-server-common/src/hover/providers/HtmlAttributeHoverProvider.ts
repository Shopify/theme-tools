import { Hover, HoverParams } from 'vscode-languageserver';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { HtmlData, renderHtmlEntry } from '../../docset';
import {
  findLast,
  getNamedHtmlElementNodeName,
  isHtmlAttribute,
  isNamedHtmlElementNode,
  isTextNode,
} from '../../utils';

export class HtmlAttributeHoverProvider implements BaseHoverProvider {
  async hover(
    _params: HoverParams,
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);
    const grandParentNode = findLast(ancestors, isNamedHtmlElementNode);
    if (
      !parentNode ||
      !grandParentNode ||
      !isTextNode(currentNode) ||
      !isHtmlAttribute(parentNode) ||
      !isNamedHtmlElementNode(grandParentNode)
    ) {
      return null;
    }
    const name = currentNode.value;
    const tagName = getNamedHtmlElementNodeName(grandParentNode);
    const tagEntry = HtmlData.tags.find((tag) => tag.name === tagName);
    const tagEntryAttributes = tagEntry?.attributes || [];
    const attribute =
      HtmlData.globalAttributes.find((attr) => attr.name === name) ??
      tagEntryAttributes.find((attr) => attr.name === name);

    if (!attribute) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: renderHtmlEntry(attribute),
      },
    };
  }
}
