import type { LiquidTag, LiquidExpression } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import {
  hasBareArrayAccess,
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

  if (hasSkippedCharacters(node.source.slice(markup.position.start, node.markupPosition.end))) {
    context.report({
      message: "Syntax error in 'case' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
