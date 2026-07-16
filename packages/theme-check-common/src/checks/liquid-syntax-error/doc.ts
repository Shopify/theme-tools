import type { LiquidRawTag } from "@editor/liquid-html-parser";
import type { Context } from ".";
import {
  hasLiquidTagNamed,
  hasRubyAcceptedRawTagCloserWithMarkup,
  liquidTagBodies,
  liquidTagMarkup,
  resolveErrorLocation,
} from "./utils.ts";

const UNCLOSED_DOC_PARSER_ERROR = "Attempting to end parsing before LiquidRawTag 'doc' was closed";
const UNOPENED_DOC_PARSER_ERROR =
  "Attempting to close LiquidTag 'doc' before it was opened without a matching 'doc'";

export function checkDocTag(node: LiquidRawTag, context: Context): void {
  if (node.markup !== "") {
    context.report({
      message: `Syntax error in 'doc' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (hasNestedDocTag(node.body.value)) {
    context.report({
      message: "Nested doc tags are not allowed",
      startIndex: node.body.position.start,
      endIndex: node.body.position.end,
    });
  }
}

function hasNestedDocTag(body: string): boolean {
  for (const tag of liquidTagBodies(body)) {
    const markup = liquidTagMarkup(tag.body);
    if (
      markup?.tagName === "enddoc" &&
      markup.remainingTokens.length > 0 &&
      !markup.hasSkippedCharacters
    ) {
      return false;
    }

    if (markup?.tagName === "doc" && !markup.hasSkippedCharacters) {
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
    hasRubyAcceptedRawTagCloserWithMarkup(source, "doc", startIndex)
  ) {
    return;
  }

  context.report({
    message: error.message,
    startIndex,
    endIndex,
  });
}

export function isDocParserError(error: Error, source: string): boolean {
  if (!hasLiquidTagNamed(source, "doc") && !hasLiquidTagNamed(source, "enddoc")) return false;

  return error.message === UNCLOSED_DOC_PARSER_ERROR || error.message === UNOPENED_DOC_PARSER_ERROR;
}
