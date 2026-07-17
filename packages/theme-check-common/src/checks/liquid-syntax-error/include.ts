import type { LiquidTag, RenderMarkup } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import {
  argHasBareArrayAccess,
  hasBareArrayAccess,
  hasRubyAcceptedIncludeMarkup,
  hasSkippedCharacters,
  rawMarkup,
} from './utils';

export function checkIncludeTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    if (hasRubyAcceptedIncludeMarkup(node.markup)) return;

    context.report({
      message: `Syntax error in 'include' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as RenderMarkup;

  if (
    hasBareArrayAccess(markup.snippet) ||
    (markup.variable && hasBareArrayAccess(markup.variable.name)) ||
    markup.args.some(argHasBareArrayAccess)
  ) {
    context.report({
      message: 'Bare bracket access is not allowed in strict2 mode',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'include' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
