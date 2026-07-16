import { NodeTypes, type LiquidTag, type RenderMarkup } from "@editor/liquid-html-parser";
import type { Context } from ".";
import {
  hasSkippedCharacters,
  hasSkippedPrefixCharacters,
  hasBareArrayAccess,
  hasUnclosedQuotedString,
  rawMarkup,
} from "./utils";

const SYNTAX_ERROR = `Syntax error in 'render' tag`;
const BARE_ARRAY_ACCESS = "Bare bracket access is not allowed in strict2 mode";

export function checkRenderTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === "string") {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  const markup = node.markup as RenderMarkup;

  if (hasUnclosedQuotedString(rawMarkup(node))) {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  if (hasRenderBareArrayAccess(markup)) {
    report(node, context, BARE_ARRAY_ACCESS);
    return;
  }

  if (hasSkippedPrefixCharacters(node.source, node.markupPosition.start, markup.position.start)) {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  const rawMarkupRemainder = node.source.slice(markup.position.start, node.markupPosition.end);
  if (hasSkippedCharacters(rawMarkupRemainder)) {
    report(node, context, SYNTAX_ERROR);
  }
}

function hasRenderBareArrayAccess(markup: RenderMarkup): boolean {
  if (markup.snippet.type === NodeTypes.VariableLookup && hasBareArrayAccess(markup.snippet)) {
    return true;
  }

  if (markup.variable && hasBareArrayAccess(markup.variable.name)) {
    return true;
  }

  return markup.args.some((arg) => hasBareArrayAccess(arg.value));
}

function report(node: LiquidTag, context: Context, message: string): void {
  context.report({
    message,
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
