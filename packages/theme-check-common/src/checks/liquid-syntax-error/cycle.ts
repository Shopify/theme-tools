import { type CycleMarkup, type LiquidTag } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import {
  hasBareArrayAccess,
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

  if (hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'cycle' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
