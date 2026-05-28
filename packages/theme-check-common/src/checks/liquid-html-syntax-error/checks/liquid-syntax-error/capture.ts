import type { LiquidTag, LiquidExpression } from './parser-compat';
import type { Context } from './context';
import { hasBareArrayAccess, hasSkippedCharacters, rawMarkup } from './utils';

export function checkCaptureTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: `Syntax error in 'capture' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasBareArrayAccess(node.markup as LiquidExpression)) {
    context.report({
      message: 'Bare bracket access is not allowed',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'capture' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
