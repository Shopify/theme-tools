import type { LiquidTag, SectionMarkup } from "@editor/liquid-html-parser";
import type { Context } from ".";
import { argHasBareArrayAccess, hasSkippedCharacters, rawMarkup } from "./utils.ts";

export function checkSectionTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === "string") {
    context.report({
      message: `Syntax error in 'section' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (node.blockEndPosition) {
    context.report({
      message: "Unknown tag 'endsection'",
      startIndex: node.blockEndPosition.start,
      endIndex: node.blockEndPosition.end,
    });
    return;
  }

  const markup = node.markup as SectionMarkup;

  if (markup.args.some(argHasBareArrayAccess)) {
    context.report({
      message: "Bare bracket access is not allowed in strict2 mode",
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'section' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
  }
}
