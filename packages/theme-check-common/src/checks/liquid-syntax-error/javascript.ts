import type { LiquidRawTag } from "@editor/liquid-html-parser";
import type { Context } from ".";
import {
  hasEmptyMarkup,
  hasLiquidTagNamed,
  liquidTagBodies,
  liquidTagMarkup,
  rawMarkup,
  resolveErrorLocation,
} from "./utils";

const SYNTAX_ERROR = "Syntax Error in 'javascript' - Valid syntax: javascript";
const UNCLOSED_ERROR = "'javascript' tag was never closed";
const UNKNOWN_END_ERROR = "Unknown tag 'endjavascript'";
const UNCLOSED_PARSER_ERROR =
  "Attempting to end parsing before LiquidRawTag 'javascript' was closed";
const UNOPENED_PARSER_ERROR =
  "Attempting to close LiquidTag 'javascript' before it was opened without a matching 'javascript'";

export function checkJavascriptTag(node: LiquidRawTag, context: Context): void {
  if (hasEmptyMarkup(rawMarkup(node))) return;

  context.report({
    message: SYNTAX_ERROR,
    startIndex: node.blockStartPosition.start,
    endIndex: node.blockStartPosition.end,
  });
}

export function checkJavascriptParserError(error: Error, context: Context, source: string): void {
  if (!hasJavascriptParserTag(source)) return;

  if (error.message === UNOPENED_PARSER_ERROR) {
    reportParserError(error, context, source, UNKNOWN_END_ERROR);
    return;
  }

  if (error.message !== UNCLOSED_PARSER_ERROR) return;

  const invalidOpening = findInvalidJavascriptOpening(source);
  if (invalidOpening) {
    context.report({
      message: SYNTAX_ERROR,
      startIndex: invalidOpening.start,
      endIndex: invalidOpening.end,
    });
    return;
  }

  const [startIndex, endIndex] = resolveErrorLocation(error, source);

  // Ruby accepts markup on the closing javascript tag, while the local raw-tag
  // scanner only recognizes bare closing tags. Treat that parser gap as valid.
  if (hasJavascriptClosingTagAfter(source, startIndex)) return;

  context.report({ message: UNCLOSED_ERROR, startIndex, endIndex });
}

function reportParserError(error: Error, context: Context, source: string, message: string): void {
  const [startIndex, endIndex] = resolveErrorLocation(error, source);
  context.report({ message, startIndex, endIndex });
}

function findInvalidJavascriptOpening(source: string): { start: number; end: number } | null {
  for (const tag of liquidTagBodies(source)) {
    const markup = liquidTagMarkup(tag.body);
    if (
      markup?.tagName === "javascript" &&
      (markup.remainingTokens.length > 0 || markup.hasSkippedCharacters)
    ) {
      return { start: tag.start, end: tag.end };
    }
  }

  return null;
}

export function hasJavascriptClosingTagAfter(source: string, startIndex: number): boolean {
  for (const tag of liquidTagBodies(source, startIndex)) {
    const markup = liquidTagMarkup(tag.body);
    if (markup?.tagName === "endjavascript") return true;
  }

  return false;
}

function hasJavascriptParserTag(source: string): boolean {
  if (hasLiquidTagNamed(source, "javascript") || hasLiquidTagNamed(source, "endjavascript")) {
    return true;
  }

  for (const tag of liquidTagBodies(source)) {
    const markup = liquidTagMarkup(tag.body);
    if (markup?.tagName === "javascript" || markup?.tagName === "endjavascript") {
      return true;
    }
  }

  return false;
}
