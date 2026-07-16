import type { LiquidRawTag } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import { hasRubyAcceptedInertCommentBodyCloser, UNMATCHED_RAW_CLOSE_PARSER_ERROR } from './comment';
import {
  hasRubyAcceptedRawTagCloserWithMarkup,
  hasSkippedCharacters,
  hasSkippedPrefixCharacters,
  rawMarkup,
  resolveErrorLocation,
} from './utils';

const UNCLOSED_RAW_PARSER_ERROR = "Attempting to end parsing before LiquidRawTag 'raw' was closed";

const RAW_PARSER_ERROR_MESSAGES = new Set([
  UNCLOSED_RAW_PARSER_ERROR,
  UNMATCHED_RAW_CLOSE_PARSER_ERROR,
  "Unclosed raw tag 'raw' in {% liquid %} block",
]);

export function checkRawTag(node: LiquidRawTag, context: Context): void {
  if (
    node.markup !== '' ||
    hasSkippedPrefixCharacters(node.source, node.markupPosition.start, node.markupPosition.end) ||
    hasSkippedCharacters(rawMarkup(node))
  ) {
    context.report({
      message: `Syntax error in 'raw' tag`,
      startIndex: node.markupPosition.start,
      endIndex: node.markupPosition.end,
    });
  }
}

export function checkRawParserError(error: Error, context: Context, source: string): void {
  if (!RAW_PARSER_ERROR_MESSAGES.has(error.message)) return;

  const [startIndex, endIndex] = resolveErrorLocation(error, source);

  if (
    error.message === UNCLOSED_RAW_PARSER_ERROR &&
    hasRubyAcceptedRawTagCloserWithMarkup(source, 'raw', startIndex)
  ) {
    return;
  }

  if (
    error.message === UNMATCHED_RAW_CLOSE_PARSER_ERROR &&
    hasRubyAcceptedInertCommentBodyCloser(source, 'raw', startIndex)
  ) {
    return;
  }

  context.report({
    message: error.message,
    startIndex,
    endIndex,
  });
}
