import { NodeTypes, type BlockMarkup, type LiquidTag } from "@editor/liquid-html-parser";
import type { Context } from ".";
import {
  hasBareArrayAccess,
  hasSkippedCharacters,
  liquidLineTagLocation,
  rawMarkup,
  resolveErrorLocation,
} from "./utils.ts";

const SYNTAX_ERROR = "Syntax error in 'block' tag";
const BARE_ARRAY_ACCESS = "Bare bracket access is not allowed in strict2 mode";
const UNCLOSED_BLOCK_PARSER_ERROR = "Attempting to end parsing before LiquidTag 'block' was closed";
const UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR = "Unclosed block tag 'block' in {% liquid %} block";
const BLOCK_PARSER_ERROR_MESSAGES = new Set([
  UNCLOSED_BLOCK_PARSER_ERROR,
  UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR,
  "Attempting to close LiquidTag 'block' before it was opened without a matching 'block'",
]);

export function checkBlockTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === "string") {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  const markup = node.markup as BlockMarkup;

  if (hasInvalidBlockName(markup.name.value)) {
    report(node, context, "Liquid syntax error: in 'block' - Valid syntax: block '[file_name]'");
    return;
  }

  if (hasInvalidBlockArguments(markup)) {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  if (markup.args.some((arg) => hasBareArrayAccess(arg.value))) {
    report(node, context, BARE_ARRAY_ACCESS);
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    report(node, context, SYNTAX_ERROR);
  }
}

export function checkBlockParserError(error: Error, context: Context, source: string): void {
  if (!BLOCK_PARSER_ERROR_MESSAGES.has(error.message)) return;

  const [startIndex, endIndex] = error.message.includes(
    "Unclosed block tag 'block' in {% liquid %} block",
  )
    ? (liquidLineTagLocation(source, "block") ?? resolveErrorLocation(error, source))
    : resolveErrorLocation(error, source);

  context.report({
    message:
      error.message === UNCLOSED_BLOCK_PARSER_ERROR
        ? "Liquid syntax error: 'block' tag was never closed"
        : error.message,
    startIndex,
    endIndex,
  });
}

function hasInvalidBlockName(value: string): boolean {
  return value.includes("/") || value.includes(".");
}

function hasInvalidBlockArguments(markup: BlockMarkup): boolean {
  return markup.args.some((arg) => {
    if (arg.name === "block.content") return false;
    if (arg.name === "block.name") return arg.value.type !== NodeTypes.String;
    if (arg.name.startsWith("block.settings.")) {
      return arg.name.slice("block.settings.".length).includes(".");
    }
    if (arg.name.startsWith("block.")) return true;

    return false;
  });
}

function report(node: LiquidTag, context: Context, message: string): void {
  context.report({
    message,
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
