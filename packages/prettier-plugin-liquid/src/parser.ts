import {
  toTolerantLiquidHtmlAST,
  walk,
  LiquidHTMLASTParsingError,
  LiquidHtmlNode,
  NodeTypes,
} from '@shopify/liquid-html-parser';

import { locEnd, locStart } from './utils';

/**
 * Parse a template for formatting. Throws when part of it doesn't parse or a
 * block or element is left open at the end, so Prettier reports the error and
 * leaves the file as it is. Printing a tree that skips a part it couldn't read,
 * or closes what the source left open, would write a different template.
 *
 * The tolerant parser still recovers inside a tag's markup, such as the
 * trailing comma in `{{ x | split: '', }}`, because that doesn't change the
 * tree around it.
 */
export function parse(text: string): LiquidHtmlNode {
  const ast = toTolerantLiquidHtmlAST(text, { mode: 'tolerant', allowUnclosedDocumentNode: false });
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
