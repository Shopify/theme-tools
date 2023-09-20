import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { HtmlData, renderHtmlEntry } from '../../docset';
import {
  findLast,
  getCompoundName,
  isHtmlAttribute,
  isNamedHtmlElementNode,
  isTextNode,
} from '../../utils';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class HtmlAttributeValueHoverProvider implements BaseHoverProvider {
  async hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null> {
    const attributeNode = findLast(ancestors, isHtmlAttribute);
    const tagNode = findLast(ancestors, isNamedHtmlElementNode);
    if (
      !isTextNode(currentNode) ||
      !attributeNode ||
      !tagNode ||
      !isHtmlAttribute(attributeNode) ||
      !isNamedHtmlElementNode(tagNode) ||
      attributeNode.type === NodeTypes.AttrEmpty ||
      attributeNode.value.length !== 1 ||
      !attributeNode.value.includes(currentNode)
    ) {
      return null;
    }

    const valueName = currentNode.value;
    const attrName = getCompoundName(attributeNode);
    const tagName = getCompoundName(tagNode);
    const tagEntry = HtmlData.tags.find((tag) => tag.name === tagName);
    const attribute =
      HtmlData.globalAttributes.find((attr) => attr.name === attrName) ??
      tagEntry?.attributes.find((attr) => attr.name === attrName);
    const valueSetName = attribute?.valueSet;
    const valueSetEntry = HtmlData.valueSets.find((valueSet) => valueSet.name === valueSetName);
    const valueEntry = valueSetEntry?.values.find((value) => value.name === valueName);
    if (!valueEntry) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: renderHtmlEntry(valueEntry, attribute?.references ? attribute : tagEntry),
      },
    };
  }
}
