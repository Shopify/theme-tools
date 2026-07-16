import type { LiquidTag, ForMarkup } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import { hasBareArrayAccess, hasSkippedCharacters, hasSkippedPrefixCharacters } from './utils';

export function checkForTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: `Syntax error in 'for' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as ForMarkup;

  if (hasBareArrayAccess(markup.collection)) {
    context.report({
      message: 'Bare bracket access is not allowed',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedPrefixCharacters(node.source, node.markupPosition.start, markup.position.start)) {
    context.report({
      message: `Syntax error in 'for' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const rawMarkup = node.source.slice(markup.position.start, node.markupPosition.end);
  if (hasSkippedCharacters(rawMarkup)) {
    context.report({
      message: `Syntax error in 'for' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
