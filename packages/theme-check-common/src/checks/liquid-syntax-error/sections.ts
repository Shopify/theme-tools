import type { LiquidTag } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import { hasSkippedCharacters, rawMarkup } from './utils';

export function checkSectionsTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: `Syntax error in 'sections' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'sections' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
