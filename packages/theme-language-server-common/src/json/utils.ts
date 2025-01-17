import { LiquidHtmlNode, LiquidRawTag } from '@shopify/liquid-html-parser';
import { SourceCodeType, visit, Visitor } from '@shopify/theme-check-common';

export function fileMatch(uri: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(uri));
}

export function isSectionFile(uri: string): boolean {
  return /\/sections\/[^/]*\.liquid$/.test(uri);
}

export function isBlockFile(uri: string): boolean {
  return /\/blocks\/[^/]*\.liquid$/.test(uri);
}

export function isSectionOrBlockFile(uri: string): boolean {
  return isSectionFile(uri) || isBlockFile(uri);
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
