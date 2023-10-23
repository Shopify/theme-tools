import { toLiquidHtmlAST, LiquidHtmlNode } from '@shopify/liquid-html-parser';

import { locEnd, locStart } from './utils';

export function parse(text: string): LiquidHtmlNode {
  return toLiquidHtmlAST(text);
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
