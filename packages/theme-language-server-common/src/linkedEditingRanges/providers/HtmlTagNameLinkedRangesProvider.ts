import { HtmlElement, LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { LinkedEditingRangeParams, Range } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseLinkedEditingRangesProvider } from '../BaseLinkedEditingRangesProvider';
import { isCovered } from '../isCovered';

export class HtmlTagNameLinkedRangesProvider implements BaseLinkedEditingRangesProvider {
  constructor(public documentManager: DocumentManager) {}

  async linkedEditingRanges(
    node: LiquidHtmlNode | null,
    ancestors: LiquidHtmlNode[] | null,
    params: LinkedEditingRangeParams,
  ) {
    if (!node || !ancestors) return null;

    const textDocument = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!textDocument) return null;

    let htmlElementNode: HtmlElement | null = null;

    // Try parent node as HTML Element
    // <name> case
    const parentNode = ancestors.at(-1);
    if (
      parentNode &&
      parentNode.type === NodeTypes.HtmlElement &&
      parentNode.name.length > 0 &&
      isCovered(textDocument.offsetAt(params.position), {
        start: parentNode.name[0].position.start,
        end: parentNode.name.at(-1)!.position.end,
      })
    ) {
      htmlElementNode = parentNode;
    }

    // </name> case
    if (
      node.type === NodeTypes.HtmlElement &&
      node.name.length > 0 &&
      isCovered(textDocument.offsetAt(params.position), node.blockEndPosition)
    ) {
      htmlElementNode = node;
    }

    if (!htmlElementNode) return null;

    const nameNodes = htmlElementNode.name;
    const firstNode = nameNodes.at(0)!;
    const lastNode = nameNodes.at(-1)!;
    const startRange = Range.create(
      textDocument.positionAt(firstNode.position.start),
      textDocument.positionAt(lastNode.position.end),
    );
    const endRange = Range.create(
      // </ means offset 2 characters
      textDocument.positionAt(htmlElementNode.blockEndPosition.start + 2),
      textDocument.positionAt(htmlElementNode.blockEndPosition.end - 1),
    );
    return {
      ranges: [startRange, endRange],
      wordPattern: '[a-zA-Z0-9-_]+',
    };
  }
}
