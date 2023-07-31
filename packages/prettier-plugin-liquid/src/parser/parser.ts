import { locEnd, locStart } from '~/utils';
import { toLiquidHtmlAST, LiquidHtmlNode } from '~/parser/stage-2-ast';

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
