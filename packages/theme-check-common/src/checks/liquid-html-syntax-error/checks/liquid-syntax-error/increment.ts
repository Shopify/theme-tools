import type { LiquidTag } from './parser-compat';
import type { Context } from './context';
import { hasSkippedCharacters, rawMarkup } from './utils';

export function checkIncrementTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: `Syntax error in 'increment' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'increment' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
