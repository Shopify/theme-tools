import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { BLOCKS, RAW_TAGS } from '@shopify/prettier-plugin-liquid/dist/parser/grammar';
import {
  LiquidHtmlNode,
  LiquidHtmlNodeOfType,
  LiquidHtmlNodeTypes,
  ThemeDocset,
} from '@shopify/theme-check-common';
import { Provider, createCompletionItem, sortByName } from './common';
import { CURSOR, LiquidCompletionParams } from '../params';

type LiquidTag = LiquidHtmlNodeOfType<LiquidHtmlNodeTypes.LiquidTag>;

export class LiquidTagsCompletionProvider implements Provider {
  constructor(private readonly themeDocset: ThemeDocset) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    if (!node || node.type !== LiquidHtmlNodeTypes.LiquidTag) {
      return [];
    }

    if (typeof node.markup !== 'string' || node.markup !== '') {
      return [];
    }

    const partial = node.name.replace(CURSOR, '');
    const blockParent = findParentNode(partial, ancestors);
    if (partial.startsWith('end') && blockParent) {
      return [
        {
          label: `end${blockParent.name}`,
          kind: CompletionItemKind.Keyword,
        },
      ];
    }

    const tags = await this.themeDocset.tags();
    return tags
      .filter(({ name }) => name.startsWith(partial))
      .sort(sortByName)
      .map((tag) => createCompletionItem(tag, { kind: CompletionItemKind.Keyword }));
  }
}

function findParentNode(partial: string, ancestors: LiquidHtmlNode[]): LiquidTag | undefined {
  if (!partial.startsWith('end')) return;

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
  const potentialParentName = partial.replace(/^end/, '');
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

// Array.prototype.findLast is only available in es2023. Which feels too new?
function findLast<T>(array: T[], pred: (n: T) => boolean): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    if (pred(array[i])) return array[i];
  }
}
