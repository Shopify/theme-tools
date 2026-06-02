import type { LiquidTag, PaginateMarkup } from './parser-compat';
import type { Context } from './context';
import {
  hasSkippedCharacters,
  hasBareArrayAccess,
  argHasBareArrayAccess,
  hasBareContainsValueExpression,
  hasSkippedPrefixCharacters,
  hasRubyAcceptedPaginateTrailingComma,
  hasConsecutiveCommaTokens,
  rawMarkup as fullRawMarkup,
} from './utils';

export function checkPaginateTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    if (hasConsecutiveCommaTokens(node.markup)) {
      context.report({
        message: `Syntax error in 'paginate' tag`,
        startIndex: node.blockStartPosition.start,
        endIndex: node.blockStartPosition.end,
      });
      return;
    }

    if (hasRubyAcceptedPaginateTrailingComma(node.markup)) {
      return;
    }

    context.report({
      message: `Syntax error in 'paginate' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  const markup = node.markup as PaginateMarkup;

  if (
    hasBareArrayAccess(markup.collection) ||
    hasBareArrayAccess(markup.pageSize) ||
    markup.args.some(argHasBareArrayAccess)
  ) {
    context.report({
      message: 'Bare bracket access is not allowed',
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (
    hasBareContainsValueExpression(markup.collection) ||
    hasBareContainsValueExpression(markup.pageSize) ||
    markup.args.some((arg) => hasBareContainsValueExpression(arg.value))
  ) {
    context.report({
      message: `Syntax error in 'paginate' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (hasSkippedPrefixCharacters(node.source, node.markupPosition.start, markup.position.start)) {
    context.report({
      message: `Syntax error in 'paginate' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (hasConsecutiveCommaTokens(fullRawMarkup(node))) {
    context.report({
      message: `Syntax error in 'paginate' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  const rawMarkup = node.source.slice(markup.position.start, node.markupPosition.end);
  if (hasSkippedCharacters(rawMarkup)) {
    context.report({
      message: `Syntax error in 'paginate' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }
}
