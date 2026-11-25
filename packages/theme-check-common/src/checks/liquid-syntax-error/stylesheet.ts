import type { LiquidRawTag } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import { hasEmptyMarkup, hasSingleStringMarkup, rawMarkup } from './utils';

export function checkStylesheetTag(node: LiquidRawTag, context: Context): void {
  const markup = rawMarkup(node);
  if (hasEmptyMarkup(markup) || hasSingleStringMarkup(markup, 'scss')) return;

  context.report({
    message: `'stylesheet' tag can only accept the string argument 'scss' in "${markup}"`,
    startIndex: node.blockStartPosition.start,
    endIndex: node.blockStartPosition.end,
  });
}
