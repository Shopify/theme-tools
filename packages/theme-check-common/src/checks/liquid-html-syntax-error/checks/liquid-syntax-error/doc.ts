import type { LiquidRawTag } from './parser-compat';
import type { Context } from './context';
import {
  hasLiquidTagNamed,
  hasRubyAcceptedRawTagCloserWithMarkup,
  resolveErrorLocation,
  liquidTagBodies,
  liquidTagMarkup,
} from './utils';

const SYNTAX_ERROR =
  "Liquid syntax error: Syntax Error in 'doc' - Valid syntax: {% doc %}{% enddoc %}";
const NESTED_DOC_ERROR =
  "Liquid syntax error: Syntax Error in 'doc' - Nested doc tags are not allowed";
const UNCLOSED_DOC_SOURCE_ERROR = "Liquid syntax error: 'doc' tag was never closed";
const UNKNOWN_ENDDOC_SOURCE_ERROR = "Liquid syntax error: Unknown tag 'enddoc'";
const UNCLOSED_DOC_PARSER_ERROR = "Attempting to end parsing before LiquidRawTag 'doc' was closed";
const UNOPENED_DOC_PARSER_ERROR =
  "Attempting to close LiquidTag 'doc' before it was opened without a matching 'doc'";

export function checkDocTag(node: LiquidRawTag, context: Context): void {
  if (node.markup !== '') {
    context.report({
      message: SYNTAX_ERROR,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (hasNestedDocTag(node.body.value)) {
    context.report({
      message: NESTED_DOC_ERROR,
      startIndex: node.body.position.start,
      endIndex: node.body.position.end,
    });
  }
}

function hasNestedDocTag(body: string): boolean {
  for (const tag of liquidTagBodies(body)) {
    const markup = liquidTagMarkup(tag.body);
    if (
      markup?.tagName === 'enddoc' &&
      markup.remainingTokens.length > 0 &&
      !markup.hasSkippedCharacters
    ) {
      return false;
    }

    if (markup?.tagName === 'doc' && !markup.hasSkippedCharacters) {
      return true;
    }
  }

  return false;
}

export function checkDocParserError(error: Error, context: Context, source: string): void {
  if (!isDocParserError(error, source)) return;

  const [startIndex, endIndex] = resolveErrorLocation(error, source);

  if (
    error.message === UNCLOSED_DOC_PARSER_ERROR &&
    hasRubyAcceptedRawTagCloserWithMarkup(source, 'doc', startIndex)
  ) {
    return;
  }

  context.report({
    message: error.message,
    startIndex,
    endIndex,
  });
}

export function checkDocSourceStructure(source: string, context: Context): void {
  const error = findDocSourceStructureError(source);
  if (!error) return;

  context.report({
    message: error.message,
    startIndex: error.startIndex,
    endIndex: error.endIndex,
  });
}

function findDocSourceStructureError(source: string): DocSourceStructureError | undefined {
  let unclosed: DocSourceStackEntry | undefined;

  for (const tag of liquidTagBodies(source)) {
    const markup = liquidTagMarkup(tag.body);
    if (!markup) continue;

    if (unclosed) {
      if (markup.tagName === 'doc') {
        return { message: NESTED_DOC_ERROR, startIndex: tag.start, endIndex: tag.end };
      }

      if (markup.tagName === 'enddoc') {
        unclosed = undefined;
      }
      continue;
    }

    if (markup.tagName === 'doc') {
      if (markup.remainingTokens.length > 0 || markup.hasSkippedCharacters) {
        return { message: SYNTAX_ERROR, startIndex: tag.start, endIndex: tag.end };
      }

      unclosed = { startIndex: tag.start, endIndex: tag.end };
      continue;
    }

    if (markup.tagName === 'enddoc') {
      return { message: UNKNOWN_ENDDOC_SOURCE_ERROR, startIndex: tag.start, endIndex: tag.end };
    }
  }

  if (!unclosed) return undefined;

  return {
    message: UNCLOSED_DOC_SOURCE_ERROR,
    startIndex: unclosed.startIndex,
    endIndex: unclosed.endIndex,
  };
}

export function isDocParserError(error: Error, source: string): boolean {
  if (!hasLiquidTagNamed(source, 'doc') && !hasLiquidTagNamed(source, 'enddoc')) return false;

  return error.message === UNCLOSED_DOC_PARSER_ERROR || error.message === UNOPENED_DOC_PARSER_ERROR;
}

interface DocSourceStructureError {
  message: string;
  startIndex: number;
  endIndex: number;
}

interface DocSourceStackEntry {
  startIndex: number;
  endIndex: number;
}
