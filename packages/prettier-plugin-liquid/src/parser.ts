import {
  toTolerantLiquidHtmlAST,
  walk,
  LiquidHTMLASTParsingError,
  LiquidHtmlNode,
  NodeTypes,
} from '@shopify/liquid-html-parser';

import { locEnd, locStart } from './utils';

/**
 * Parse a template for formatting. Throws when part of it doesn't parse, so
 * Prettier reports the error and leaves the file as it is. A tree that skips
 * a part it couldn't read would print a different template.
 */
export function parse(text: string): LiquidHtmlNode {
  const ast = toTolerantLiquidHtmlAST(text);
  walk(ast, (node) => {
    if (node.type === NodeTypes.LiquidErrorNode) {
      throw new LiquidHTMLASTParsingError(
        node.message,
        text,
        node.position.start,
        node.position.end,
      );
    }
  });
  return ast;
}

export const liquidHtmlAstFormat = 'liquid-html-ast';

export const liquidHtmlLanguageName = 'liquid-html';

export const liquidHtmlParser = {
  parse,
  astFormat: liquidHtmlAstFormat,
  locStart,
  locEnd,
};

export const parsers = {
  [liquidHtmlLanguageName]: liquidHtmlParser,
};
