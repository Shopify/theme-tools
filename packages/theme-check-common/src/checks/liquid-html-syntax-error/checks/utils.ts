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

export function combineChecks(...checks: any[]) {
  const combined: any = {};
  const handlerGroups: { [key: string]: any[] } = {};

  for (const check of checks) {
    for (const [handlerName, handler] of Object.entries(check)) {
      if (!handlerGroups[handlerName]) {
        handlerGroups[handlerName] = [];
      }
      handlerGroups[handlerName].push(handler);
    }
  }

  for (const [handlerName, handlers] of Object.entries(handlerGroups)) {
    if (handlers.length === 1) {
      combined[handlerName] = handlers[0];
    } else {
      combined[handlerName] = async (...args: any[]) => {
        for (const handler of handlers) {
          await handler(...args);
        }
      };
    }
  }

  return combined;
}
