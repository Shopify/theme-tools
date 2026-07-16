import type { LiquidTag } from "@editor/liquid-html-parser";
import type { Context } from ".";
import { hasRubyValidInlineCommentMarkup, rawMarkup } from "./utils";

export function checkInlineCommentTag(node: LiquidTag, context: Context): void {
  if (hasRubyValidInlineCommentMarkup(rawMarkup(node))) return;

  context.report({
    message:
      "Syntax error in tag '#' - Each line of comments must be prefixed by the '#' character",
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
