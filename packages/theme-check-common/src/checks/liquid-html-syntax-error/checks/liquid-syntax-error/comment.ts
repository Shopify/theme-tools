import { TokenType, tokenize, type LiquidRawTag, type Token } from './parser-compat';
import type { Context } from './context';
import { liquidTagBodies, liquidTagMarkup, resolveErrorLocation } from './utils';

const COMMENT_RAW_BODY_ERROR = "Liquid syntax error: 'comment' tag was never closed";
const UNCLOSED_COMMENT_SOURCE_ERROR = "Liquid syntax error: 'comment' tag was never closed";
const UNCLOSED_RAW_SOURCE_ERROR = "Liquid syntax error: 'raw' tag was never closed";
const UNKNOWN_ENDCOMMENT_SOURCE_ERROR = "Liquid syntax error: Unknown tag 'endcomment'";
export const UNMATCHED_COMMENT_CLOSE_PARSER_ERROR =
  "Attempting to close LiquidTag 'comment' before it was opened without a matching 'comment'";
export const UNMATCHED_RAW_CLOSE_PARSER_ERROR =
  "Attempting to close LiquidTag 'raw' before it was opened without a matching 'raw'";

export function checkCommentTag(error: Error, context: Context, source: string): void {
  if (!isCommentParserError(error, source)) return;

  const [startIndex, endIndex] = resolveErrorLocation(error, source);

  if (
    error.message === UNMATCHED_COMMENT_CLOSE_PARSER_ERROR &&
    hasRubyAcceptedInertCommentBodyCloser(source, 'comment', startIndex)
  ) {
    return;
  }

  context.report({
    message: error.message,
    startIndex,
    endIndex,
  });
}

export function checkCommentRawTag(node: LiquidRawTag, context: Context): void {
  const body = node.body.value;

  if (
    hasUnbalancedCommentTags(body, node.source, node.blockEndPosition.end) ||
    hasUnbalancedRawTags(body, node.source, node.blockEndPosition.end) ||
    hasUnclosedLiquidDelimiter(body)
  ) {
    context.report({
      message: COMMENT_RAW_BODY_ERROR,
      startIndex: node.body.position.start,
      endIndex: node.body.position.end,
    });
  }
}

export function checkCommentSourceStructure(source: string, context: Context): void {
  const error = findCommentSourceStructureError(source);
  if (!error) return;

  context.report({
    message: error.message,
    startIndex: error.startIndex,
    endIndex: error.endIndex,
  });
}

function isCommentParserError(error: Error, source: string): boolean {
  if (!hasCompleteLiquidTag(source, 'comment') && !hasCompleteLiquidTag(source, 'endcomment')) {
    return false;
  }

  return (
    error.message === "Attempting to end parsing before LiquidRawTag 'comment' was closed" ||
    error.message === UNMATCHED_COMMENT_CLOSE_PARSER_ERROR
  );
}

function hasUnclosedLiquidDelimiter(body: string): boolean {
  const tokens = tokenize(body);

  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    const text = tokens[i + 1];
    const close = text?.type === TokenType.Text ? tokens[i + 2] : text;

    if (open.type === TokenType.LiquidTagOpen) {
      if (close?.type !== TokenType.LiquidTagClose) return true;
      continue;
    }

    if (open.type === TokenType.LiquidVariableOutputOpen) {
      if (close?.type !== TokenType.LiquidVariableOutputClose) return true;
    }
  }

  return false;
}

function findCommentSourceStructureError(source: string): CommentSourceStructureError | undefined {
  const stack: CommentSourceStackEntry[] = [];

  for (const tag of liquidTagBodies(source)) {
    const markup = liquidTagMarkup(tag.body);
    if (!markup || markup.hasSkippedCharacters) continue;

    if (topTag(stack) === 'raw') {
      if (markup.tagName === 'endraw') stack.pop();
      continue;
    }

    if (markup.tagName === 'comment') {
      stack.push({ tagName: 'comment', startIndex: tag.start, endIndex: tag.end });
      continue;
    }

    if (markup.tagName === 'raw' && stack.length > 0) {
      stack.push({ tagName: 'raw', startIndex: tag.start, endIndex: tag.end });
      continue;
    }

    if (markup.tagName === 'endcomment') {
      if (topTag(stack) === 'comment') {
        stack.pop();
        continue;
      }

      if (stack.length === 0) {
        return {
          message: UNKNOWN_ENDCOMMENT_SOURCE_ERROR,
          startIndex: tag.start,
          endIndex: tag.end,
        };
      }
    }
  }

  const unclosed = stack[stack.length - 1];
  if (!unclosed) return undefined;

  return {
    message: unclosed.tagName === 'raw' ? UNCLOSED_RAW_SOURCE_ERROR : UNCLOSED_COMMENT_SOURCE_ERROR,
    startIndex: unclosed.startIndex,
    endIndex: unclosed.endIndex,
  };
}

function topTag(stack: CommentSourceStackEntry[]): CommentSourceStackEntry['tagName'] | undefined {
  return stack[stack.length - 1]?.tagName;
}

function hasUnbalancedCommentTags(
  body: string,
  source: string,
  sourceAfterClosingTagStart: number,
): boolean {
  return hasUnbalancedNestedTags(body, source, sourceAfterClosingTagStart, 'comment');
}

function hasUnbalancedRawTags(
  body: string,
  source: string,
  sourceAfterClosingTagStart: number,
): boolean {
  return hasUnbalancedNestedTags(body, source, sourceAfterClosingTagStart, 'raw');
}

function hasUnbalancedNestedTags(
  body: string,
  source: string,
  sourceAfterClosingTagStart: number,
  tagName: 'comment' | 'raw',
): boolean {
  let depth = tagNestingDepth(body, tagName);
  if (depth === 0) return false;

  for (const tag of liquidTagBodies(source, sourceAfterClosingTagStart)) {
    const markup = liquidTagMarkup(tag.body);
    if (!markup || markup.hasSkippedCharacters) continue;

    if (markup.tagName === tagName) {
      depth++;
      continue;
    }

    if (markup.tagName === `end${tagName}`) {
      depth--;
      if (depth === 0) return false;
    }
  }

  return true;
}

function tagNestingDepth(body: string, tagName: 'comment' | 'raw'): number {
  let depth = 0;

  for (const tag of liquidTagBodies(body)) {
    const markup = liquidTagMarkup(tag.body);
    if (!markup || markup.hasSkippedCharacters) continue;

    if (markup.tagName === tagName) {
      depth++;
      continue;
    }

    if (markup.tagName === `end${tagName}` && depth > 0) {
      depth--;
    }
  }

  return depth;
}

function countLiquidTag(
  source: string,
  tagName: string,
  startIndex = 0,
  endIndex = source.length,
): number {
  return liquidTagBodies(source, startIndex).filter((tag) => {
    if (tag.bodyStart >= endIndex) return false;

    const markup = liquidTagMarkup(tag.body);
    return markup?.tagName === tagName && !markup.hasSkippedCharacters;
  }).length;
}

export function hasRubyAcceptedInertCommentBodyCloser(
  source: string,
  tagName: 'comment' | 'raw',
  startIndex: number,
): boolean {
  const endTagName = `end${tagName}`;
  const closer = liquidTagAt(source, startIndex);

  if (closer?.tagName !== endTagName || closer.hasSkippedCharacters) {
    return false;
  }

  if (tagName === 'comment') {
    return (
      countLiquidTag(source, 'comment', 0, startIndex) >
      countLiquidTag(source, 'endcomment', 0, startIndex)
    );
  }

  return (
    countLiquidTag(source, 'raw', 0, startIndex) >
      countLiquidTag(source, 'endraw', 0, startIndex) &&
    countLiquidTag(source, 'comment', 0, startIndex) > 0 &&
    countLiquidTag(source, 'endcomment', startIndex) > 0
  );
}

function hasCompleteLiquidTag(source: string, tagName: string): boolean {
  return countLiquidTag(source, tagName) > 0;
}

function liquidTagAt(source: string, startIndex: number): ReturnType<typeof liquidTagMarkup> {
  const tokens = tokenize(source);

  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (open.type !== TokenType.LiquidTagOpen || open.start !== startIndex) continue;

    const text = tokens[i + 1];
    const close = text?.type === TokenType.Text ? tokens[i + 2] : text;
    if (!close || close.type !== TokenType.LiquidTagClose) return undefined;

    return liquidTagMarkup(liquidTagBody(source, text?.type === TokenType.Text ? text : undefined));
  }

  return undefined;
}

function liquidTagBody(source: string, text: Token | undefined): string {
  return text ? source.substring(text.start, text.end) : '';
}

interface CommentSourceStructureError {
  message: string;
  startIndex: number;
  endIndex: number;
}

interface CommentSourceStackEntry {
  tagName: 'comment' | 'raw';
  startIndex: number;
  endIndex: number;
}
