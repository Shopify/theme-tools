import {
  BLOCKS,
  LiquidHtmlNode,
  LiquidTag,
  NodeTypes,
  RAW_TAGS,
} from '@shopify/liquid-html-parser';
import { ThemeDocset } from '@shopify/theme-check-common';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { findLast } from '../../utils';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem, sortByName } from './common';

export class LiquidTagsCompletionProvider implements Provider {
  constructor(private readonly themeDocset: ThemeDocset) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    if (!node || node.type !== NodeTypes.LiquidTag) {
      return [];
    }

    if (typeof node.markup !== 'string' || node.markup !== '') {
      return [];
    }

    const partial = node.name.replace(CURSOR, '');
    const blockParent = findParentNode(partial, ancestors);
    const tags = await this.themeDocset.tags();
    return tags
      .filter(({ name }) => name.startsWith(partial))
      .sort(sortByName)
      .map((tag) => createCompletionItem(tag, { kind: CompletionItemKind.Keyword }, 'tag'))
      .concat(
        blockParent && `end${blockParent.name}`.startsWith(partial)
          ? {
              label: `end${blockParent.name}`,
              kind: CompletionItemKind.Keyword,
              sortText: `!end${blockParent.name}`, // we want this first.
            }
          : [],
      );
  }
}

function findParentNode(partial: string, ancestors: LiquidHtmlNode[]): LiquidTag | undefined {
  if (!'end'.startsWith(partial)) return;
  // This covers the scenario where we have a dangling conditional tag
  //
  // e.g.
  // {% if cond %}
  //   hello
  // {% end %}
  //
  // In that scenario, we have the following tree:
  //
  // type: Document
  // children:
  //   - LiquidTag#if
  //     children:
  //       - LiquidBranch
  //         children:
  //           - TextNode#hello
  //           - LiquidTag#end
  const potentialParentName = partial.replace(/^e(nd?)?/, '');
  const parentNode = ancestors.at(-1);
  const grandParentNode = ancestors.at(-2);
  if (
    parentNode &&
    parentNode.type === 'LiquidBranch' &&
    grandParentNode &&
    grandParentNode.type === 'LiquidTag' &&
    grandParentNode.name.startsWith(potentialParentName)
  ) {
    return grandParentNode;
  }

  // This covers the scenario where we have a dangling block tag
  //
  // e.g.
  // {% form "cart", cart %}
  //   hello
  // {% end %}
  //
  // In that scenario, we have the following tree:
  //
  // type: Document
  // children:
  //   - LiquidTag#form
  //     children:
  //       - TextNode#hello
  //       - LiquidTag#end
  if (
    parentNode &&
    parentNode.type === 'LiquidTag' &&
    parentNode.name.startsWith(potentialParentName)
  ) {
    return parentNode;
  }

  // This covers the case where a raw tag is being parsed as a LiquidTag
  // because of the missing endtag.
  //
  // e.g.
  // {% comment %}
  //   hello
  // {% end %}
  //
  // In that scenario, we have the following tree:
  //
  // type: Document
  // children:
  //   - LiquidTag#comment
  //   - TextNode#hello
  //   - LiquidTag#end
  let previousNode: LiquidHtmlNode | undefined;
  if (
    parentNode &&
    'children' in parentNode &&
    Array.isArray(parentNode.children) &&
    (previousNode = findLast(
      parentNode.children,
      (node: LiquidHtmlNode): node is LiquidTag =>
        node.type === 'LiquidTag' &&
        node.name.startsWith(potentialParentName) &&
        (BLOCKS.includes(node.name) || RAW_TAGS.includes(node.name)),
    ))
  ) {
    return previousNode as LiquidTag;
  }
}
