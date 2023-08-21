import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import {
  Provider,
  sortByName,
  renderHtmlEntry,
  isTextNode,
  isAttrEmpty,
  isNamedHtmlElementNode,
  getNamedHtmlElementNodeName,
} from './common';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Attribute, HtmlData } from '../HtmlDocset';
import { findLast } from '../../utils';

export class HtmlAttributeCompletionProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = findLast(ancestors, isAttrEmpty);
    const grandParentNode = findLast(ancestors, isNamedHtmlElementNode);

    if (!node || !parentNode || !grandParentNode) {
      return [];
    }

    if (!isTextNode(node) || !isAttrEmpty(parentNode) || !isNamedHtmlElementNode(grandParentNode)) {
      return [];
    }

    const grandParentNodeName = getNamedHtmlElementNodeName(grandParentNode);
    const name = node.value;
    const partial = name.replace(CURSOR, '');
    const options = getOptions(partial, grandParentNodeName);
    return options.sort(sortByName).map(toCompletionItem);
  }
}

function getOptions(partial: string, parentNodeName: string): Attribute[] {
  const tag = HtmlData.tags.find((tag) => tag.name === parentNodeName);
  const parentAttributes = tag?.attributes ?? [];
  return [...parentAttributes, ...HtmlData.globalAttributes].filter((x) =>
    x.name.startsWith(partial),
  );
}

function toCompletionItem(tag: Attribute): CompletionItem {
  return {
    label: tag.name,
    kind: CompletionItemKind.Value,
    documentation: {
      kind: 'markdown',
      value: renderHtmlEntry(tag),
    },
  };
}
