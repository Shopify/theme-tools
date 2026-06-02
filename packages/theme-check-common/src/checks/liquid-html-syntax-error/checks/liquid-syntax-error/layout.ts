import type { LiquidExpression, LiquidTag } from './parser-compat';
import type { Context } from './context';
import {
  hasBareContainsValueExpression,
  hasSkippedCharacters,
  hasBareArrayAccess,
  rawMarkup,
} from './utils';

export function checkLayoutTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: `Syntax error in 'layout' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as LiquidExpression;

  if (hasBareArrayAccess(markup)) {
    context.report({
      message: 'Bare bracket access is not allowed in strict2 mode',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasBareContainsValueExpression(markup)) {
    context.report({
      message: `Syntax error in 'layout' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'layout' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
