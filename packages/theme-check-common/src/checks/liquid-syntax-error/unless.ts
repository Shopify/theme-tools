import type { LiquidTag, LiquidConditionalExpression } from "@editor/liquid-html-parser";
import type { Context } from ".";
import {
  conditionalHasBareArrayAccess,
  hasSkippedCharacters,
  hasSkippedPrefixCharacters,
  hasUnclosedQuotedString,
  rawMarkup,
} from "./utils";

export function checkUnlessTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === "string") {
    context.report({
      message: "Syntax error in 'unless' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const source = node.source;
  const markup = node.markup as LiquidConditionalExpression;
  const tagMarkup = rawMarkup(node);

  if (hasUnclosedQuotedString(tagMarkup)) {
    context.report({
      message: "Syntax error in 'unless' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (conditionalHasBareArrayAccess(markup)) {
    context.report({
      message: "Bare bracket access is not allowed in strict2 mode",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedPrefixCharacters(source, node.markupPosition.start, markup.position.start)) {
    context.report({
      message: "Syntax error in 'unless' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(source.slice(markup.position.start, node.markupPosition.end))) {
    context.report({
      message: "Syntax error in 'unless' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
