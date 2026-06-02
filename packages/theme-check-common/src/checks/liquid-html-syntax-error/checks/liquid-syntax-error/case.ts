import type { LiquidTag, LiquidExpression } from './parser-compat';
import type { Context } from './context';
import {
  hasBareArrayAccess,
  hasBareContainsValueExpression,
  hasSkippedCharacters,
  hasUnclosedQuotedString,
  rawMarkup,
} from './utils';

export function checkCaseTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: "Syntax error in 'case' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as LiquidExpression;

  if (hasUnclosedQuotedString(rawMarkup(node))) {
    context.report({
      message: "Syntax error in 'case' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasBareArrayAccess(markup)) {
    context.report({
      message: 'Bare bracket access is not allowed',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasBareContainsValueExpression(markup)) {
    context.report({
      message: "Syntax error in 'case' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(node.source.slice(markup.position.start, node.markupPosition.end))) {
    context.report({
      message: "Syntax error in 'case' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
