import type { LiquidTag } from './parser-compat';
import type { Context } from './context';
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
