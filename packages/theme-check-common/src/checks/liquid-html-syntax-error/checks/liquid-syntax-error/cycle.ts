import { type CycleMarkup, type LiquidTag } from './parser-compat';
import type { Context } from './context';
import {
  hasBareArrayAccess,
  hasBareContainsValueExpression,
  hasRubyAcceptedCycleTrailingComma,
  hasSkippedCharacters,
  rawMarkup,
} from './utils';

export function checkCycleTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    if (hasRubyAcceptedCycleTrailingComma(node.markup)) {
      return;
    }

    context.report({
      message: `Syntax error in 'cycle' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as CycleMarkup;

  if (
    (markup.groupName && hasBareArrayAccess(markup.groupName)) ||
    markup.args.some(hasBareArrayAccess)
  ) {
    context.report({
      message: 'Bare bracket access is not allowed',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (
    (markup.groupName && hasBareContainsValueExpression(markup.groupName)) ||
    markup.args.some(hasBareContainsValueExpression)
  ) {
    context.report({
      message: `Syntax error in 'cycle' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'cycle' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
