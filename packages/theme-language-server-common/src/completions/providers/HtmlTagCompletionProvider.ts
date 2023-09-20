import {
  HtmlDanglingMarkerClose,
  HtmlElement,
  NodeTypes,
  TextNode,
} from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { HtmlData, Tag, renderHtmlEntry } from '../../docset';
import { isTextNode } from '../../utils';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, sortByName } from './common';

type CompletableParentNode = (HtmlElement | HtmlDanglingMarkerClose) & { name: [TextNode] };

export class HtmlTagCompletionProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);
    const grandParentNode = ancestors.at(-2);

    if (node && node.type === NodeTypes.HtmlVoidElement) {
      const options = HtmlData.tags.filter((tag) => tag.name === node.name);
      return options.map(toCompletionItem);
    }

    if (!node || !parentNode || !isTextNode(node) || !canComplete(node, parentNode)) {
      return [];
    }

    const name = node.value;
    const partial = name.replace(CURSOR, '');
    const options = getOptions(partial, parentNode, grandParentNode);
    return options.sort(sortByName).map(toCompletionItem);
  }
}

function canComplete(
  node: TextNode,
  parentNode: LiquidHtmlNode,
): parentNode is CompletableParentNode {
  return (
    isElementOrDanglingClose(parentNode) &&
    parentNode.name.includes(node) &&
    parentNode.name.length === 1
  );
}

function getOptions(
  partial: string,
  parentNode: CompletableParentNode,
  grandParentNode: LiquidHtmlNode | undefined,
): Tag[] {
  if (parentNode.type === NodeTypes.HtmlDanglingMarkerClose) {
    return grandParentCloseOption(grandParentNode);
  }

  const grandParentName = getGrandParentName(grandParentNode);
  return HtmlData.tags
    .filter((tag) => tag.name.startsWith(partial))
    .concat(
      grandParentName && partial === ''
        ? {
            name: '/' + grandParentName,
            description: '',
            attributes: [],
            references: [],
          }
        : [],
    );
}

function toCompletionItem(tag: Tag): CompletionItem {
  return {
    label: tag.name,
    kind: CompletionItemKind.Property,
    documentation: {
      kind: 'markdown',
      value: renderHtmlEntry(tag),
    },
  };
}

function grandParentCloseOption(grandParentNode: LiquidHtmlNode | undefined): Tag[] {
  const grandParentName = getGrandParentName(grandParentNode);
  if (grandParentName) {
    return [
      HtmlData.tags.find((tag) => tag.name === grandParentName) ?? {
        name: grandParentName,
        description: '',
        attributes: [],
        references: [],
      },
    ];
  } else {
    return [];
  }
}

function getGrandParentName(grandParentNode: LiquidHtmlNode | undefined): string | undefined {
  if (
    grandParentNode &&
    grandParentNode.type === NodeTypes.HtmlElement &&
    grandParentNode.name.length === 1 &&
    isTextNode(grandParentNode.name[0])
  ) {
    return grandParentNode.name[0].value.replace(CURSOR, '');
  }
}

function isElementOrDanglingClose(
  node: LiquidHtmlNode,
): node is HtmlElement | HtmlDanglingMarkerClose {
  return [NodeTypes.HtmlElement, NodeTypes.HtmlDanglingMarkerClose].includes(node.type);
}
