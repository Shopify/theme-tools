import { toLiquidAST } from '@shopify/liquid-html-parser';
import { isError } from '../../../utils';

export const INVALID_SYNTAX_MESSAGE = 'Syntax is not supported';

export function ensureValidAst(source: string) {
  try {
    const ast = toLiquidAST(source, { allowUnclosedDocumentNode: false, mode: 'strict' });
    return !isError(ast);
  } catch (_error) {
    return false;
  }
}

export function getValuesInMarkup(markup: string) {
  return [...markup.matchAll(/"[^"]*"|'[^']*'|\S+/g)].map((match) => ({
    value: match[0],
    index: match.index,
  }));
}
