import type { LiquidString, LiquidTag } from "@editor/liquid-html-parser";
import type { Context } from ".";
import {
  hasSkippedCharacters,
  liquidLineTagLocation,
  rawMarkup,
  resolveErrorLocation,
} from "./utils.ts";

const SYNTAX_ERROR = "Syntax error in 'partial' tag";
const UNCLOSED_PARTIAL_PARSER_ERROR =
  "Attempting to end parsing before LiquidTag 'partial' was closed";
const UNCLOSED_PARTIAL_IN_LIQUID_PARSER_ERROR =
  "Unclosed block tag 'partial' in {% liquid %} block";
const PARTIAL_PARSER_ERROR_MESSAGES = new Set([
  UNCLOSED_PARTIAL_PARSER_ERROR,
  UNCLOSED_PARTIAL_IN_LIQUID_PARSER_ERROR,
  "Attempting to close LiquidTag 'partial' before it was opened without a matching 'partial'",
]);

export function checkPartialTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === "string") {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  const markup = node.markup as LiquidString;

  if (hasInvalidPartialName(markup.value)) {
    report(
      node,
      context,
      "Liquid syntax error: Error in tag 'partial' - Valid syntax: partial '[name]'",
    );
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    report(node, context, SYNTAX_ERROR);
  }
}

export function checkPartialParserError(error: Error, context: Context, source: string): void {
  if (!PARTIAL_PARSER_ERROR_MESSAGES.has(error.message)) return;

  const [startIndex, endIndex] = error.message.includes(
    "Unclosed block tag 'partial' in {% liquid %} block",
  )
    ? (liquidLineTagLocation(source, "partial") ?? resolveErrorLocation(error, source))
    : resolveErrorLocation(error, source);

  context.report({
    message:
      error.message === UNCLOSED_PARTIAL_PARSER_ERROR
        ? "Liquid syntax error: 'partial' tag was never closed"
        : error.message,
    startIndex,
    endIndex,
  });
}

function hasInvalidPartialName(value: string): boolean {
  return value === "" || value.includes("/");
}

function report(node: LiquidTag, context: Context, message: string): void {
  context.report({
    message,
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
