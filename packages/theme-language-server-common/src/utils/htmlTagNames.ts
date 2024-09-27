import { LiquidHtmlNode, HtmlElement, NodeTypes } from '@shopify/liquid-html-parser';
import { TextDocumentPositionParams, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { isCovered } from './isCovered';

export function getHtmlElementNameRanges(
  node: LiquidHtmlNode,
  ancestors: LiquidHtmlNode[],
  params: TextDocumentPositionParams,
  textDocument: TextDocument,
): Range[] | null {
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

  if (!htmlElementNode || isDanglingOpenHtmlElement(htmlElementNode)) return null;

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

  return [startRange, endRange];
}

export function isDanglingOpenHtmlElement(node: LiquidHtmlNode) {
  return (
    node.type === NodeTypes.HtmlElement && node.blockEndPosition.start === node.blockEndPosition.end
  );
}
