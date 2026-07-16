import type { LiquidTag, LiquidVariable } from "@editor/liquid-html-parser";
import type { Context } from ".";
import {
  variableHasBareArrayAccess,
  hasEmptyMarkup,
  hasSkippedCharacters,
  rawMarkup,
  hasRubyAcceptedEmptyFirstFilterArgument,
  hasRubyAcceptedFilterArgumentTrailingComma,
} from "./utils";

export function checkEchoTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === "string") {
    if (hasEmptyMarkup(rawMarkup(node))) return;
    if (hasRubyAcceptedEmptyFirstFilterArgument(node.markup)) return;
    if (hasRubyAcceptedFilterArgumentTrailingComma(node.markup)) return;

    context.report({
      message: `Syntax error in 'echo' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as LiquidVariable;

  if (variableHasBareArrayAccess(markup)) {
    context.report({
      message: "Bare bracket access is not allowed",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const raw = rawMarkup(node);
  if (hasRubyAcceptedEmptyFirstFilterArgument(raw)) return;
  if (hasRubyAcceptedFilterArgumentTrailingComma(raw)) return;

  if (hasSkippedCharacters(raw)) {
    context.report({
      message: `Syntax error in 'echo' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
