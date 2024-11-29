import { LiquidHtmlNode, LiquidRawTag } from '@shopify/liquid-html-parser';
import { SourceCodeType, visit, Visitor } from '@shopify/theme-check-common';

export function fileMatch(uri: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(uri));
}

export function findSchemaNode(ast: LiquidHtmlNode): LiquidRawTag | undefined {
  const nodes = visit(ast, {
    LiquidRawTag(node) {
      if (node.name === 'schema') {
        return node;
      }
    },
  } as Visitor<SourceCodeType.LiquidHtml, LiquidRawTag>);

  return nodes[0];
}
