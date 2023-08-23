import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { Attribute, HtmlData, Tag, Value, renderHtmlEntry } from '../../docset';
import {
  findLast,
  getCompoundName,
  isAttrEmpty,
  isHtmlAttribute,
  isNamedHtmlElementNode,
  isTextNode,
} from '../../utils';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, sortByName } from './common';

export class HtmlAttributeValueCompletionProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const attributeNode = findLast(ancestors, isHtmlAttribute);
    const tagNode = findLast(ancestors, isNamedHtmlElementNode);

    if (
      !node ||
      !attributeNode ||
      !tagNode ||
      !isTextNode(node) ||
      !isHtmlAttribute(attributeNode) ||
      !isNamedHtmlElementNode(tagNode) ||
      isAttrEmpty(attributeNode) ||
      !attributeNode.value.includes(node)
    ) {
      return [];
    }

    const tagName = getCompoundName(tagNode);
    const attrName = getCompoundName(attributeNode);
    const name = node.value;
    const partial = name.replace(CURSOR, '');
    const tagEntry = HtmlData.tags.find((tag) => tag.name === tagName);
    const attribute =
      HtmlData.globalAttributes.find((attr) => attr.name === attrName) ??
      tagEntry?.attributes.find((attr) => attr.name === attrName);
    const valueSetName = attribute?.valueSet;
    const valueSetEntry = HtmlData.valueSets.find((valueSet) => valueSet.name === valueSetName);
    const options = (valueSetEntry?.values ?? []).filter((value) => value.name.startsWith(partial));
    return options
      .sort(sortByName)
      .map((option) =>
        toCompletionItem(option, attribute && 'references' in attribute ? attribute : tagEntry),
      );
  }
}

function toCompletionItem(value: Value, parentEntry?: Attribute | Tag): CompletionItem {
  return {
    label: value.name,
    kind: CompletionItemKind.Value,
    documentation: {
      kind: 'markdown',
      value: renderHtmlEntry(value, parentEntry),
    },
  };
}
