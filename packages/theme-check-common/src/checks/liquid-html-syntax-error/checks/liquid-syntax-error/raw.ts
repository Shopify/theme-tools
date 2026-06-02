import type { LiquidRawTag } from './parser-compat';
import type { Context } from './context';
import { hasRubyAcceptedInertCommentBodyCloser, UNMATCHED_RAW_CLOSE_PARSER_ERROR } from './comment';
import {
  hasRubyAcceptedRawTagCloserWithMarkup,
  hasSkippedCharacters,
  hasSkippedPrefixCharacters,
  liquidTagBodies,
  liquidTagMarkup,
  rawMarkup,
  resolveErrorLocation,
} from './utils';

const SYNTAX_ERROR = "Liquid syntax error: Syntax Error in 'raw' - Valid syntax: raw";
const UNCLOSED_RAW_SOURCE_ERROR = "Liquid syntax error: 'raw' tag was never closed";
const UNKNOWN_ENDRAW_SOURCE_ERROR = "Liquid syntax error: Unknown tag 'endraw'";
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

export function checkRawSourceStructure(source: string, context: Context): void {
  const error = findRawSourceStructureError(source);
  if (!error) return;

  context.report({
    message: error.message,
    startIndex: error.startIndex,
    endIndex: error.endIndex,
  });
}

function findRawSourceStructureError(source: string): RawSourceStructureError | undefined {
  let unclosed: RawSourceStackEntry | undefined;

  for (const tag of liquidTagBodies(source)) {
    const markup = liquidTagMarkup(tag.body);
    if (!markup) continue;

    if (unclosed) {
      if (markup.tagName === 'endraw') {
        unclosed = undefined;
      }
      continue;
    }

    if (markup.tagName === 'raw') {
      if (markup.remainingTokens.length > 0 || markup.hasSkippedCharacters) {
        return { message: SYNTAX_ERROR, startIndex: tag.start, endIndex: tag.end };
      }

      unclosed = { startIndex: tag.start, endIndex: tag.end };
      continue;
    }

    if (markup.tagName === 'endraw') {
      return { message: UNKNOWN_ENDRAW_SOURCE_ERROR, startIndex: tag.start, endIndex: tag.end };
    }
  }

  if (!unclosed) return undefined;

  return {
    message: UNCLOSED_RAW_SOURCE_ERROR,
    startIndex: unclosed.startIndex,
    endIndex: unclosed.endIndex,
  };
}

interface RawSourceStructureError {
  message: string;
  startIndex: number;
  endIndex: number;
}

interface RawSourceStackEntry {
  startIndex: number;
  endIndex: number;
}
