import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { Attribute, HtmlData, renderHtmlEntry } from '../../docset';
import {
  findLast,
  getCompoundName,
  isAttrEmpty,
  isNamedHtmlElementNode,
  isTextNode,
} from '../../utils';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, sortByName } from './common';

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

    const grandParentNodeName = getCompoundName(grandParentNode);
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
