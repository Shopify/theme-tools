import type { LiquidRawTag } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import { hasEmptyMarkup, rawMarkup } from './utils';

export function checkStyleTag(node: LiquidRawTag, context: Context): void {
  const markup = rawMarkup(node);
  if (hasEmptyMarkup(markup)) return;

  context.report({
    message: `'style' tag does not accept any arguments in "${markup}"`,
    startIndex: node.blockStartPosition.start,
    endIndex: node.blockStartPosition.end,
  });
}
