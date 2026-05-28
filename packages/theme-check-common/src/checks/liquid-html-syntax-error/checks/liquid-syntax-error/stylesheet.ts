import type { LiquidRawTag } from './parser-compat';
import type { Context } from './context';
import { hasEmptyMarkup, hasSingleIdMarkup, rawMarkup } from './utils';

export function checkStylesheetTag(node: LiquidRawTag, context: Context): void {
  const markup = rawMarkup(node);
  if (!hasEmptyMarkup(markup) && !hasSingleIdMarkup(markup, 'scss')) {
    context.report({
      message: `'stylesheet' tag can only accept the argument 'scss' in "${markup}"`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
  }
}
