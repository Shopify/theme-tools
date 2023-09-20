import { Hover } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { HtmlData, renderHtmlEntry } from '../../docset';
import {
  findLast,
  getCompoundName,
  isHtmlAttribute,
  isNamedHtmlElementNode,
  isTextNode,
} from '../../utils';
import { LiquidHtmlNode } from '@shopify/liquid-html-parser';

export class HtmlAttributeHoverProvider implements BaseHoverProvider {
  async hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null> {
    const attributeNode = ancestors.at(-1);
    const tagNode = findLast(ancestors, isNamedHtmlElementNode);
    if (
      !attributeNode ||
      !tagNode ||
      !isTextNode(currentNode) ||
      !isHtmlAttribute(attributeNode) ||
      !attributeNode.name.includes(currentNode) ||
      attributeNode.name.length > 1 ||
      !isNamedHtmlElementNode(tagNode)
    ) {
      return null;
    }

    const name = currentNode.value;
    const tagName = getCompoundName(tagNode);
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
        value: renderHtmlEntry(attribute, 'references' in attribute ? undefined : tagEntry),
      },
    };
  }
}
