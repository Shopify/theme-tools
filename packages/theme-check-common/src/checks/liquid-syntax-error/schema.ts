import type { LiquidRawTag } from "@editor/liquid-html-parser";
import type { Context } from ".";

export function checkSchemaTag(node: LiquidRawTag, context: Context): void {
  if (node.markup !== "") {
    context.report({
      message: `Syntax error in 'schema' tag`,
      startIndex: node.markupPosition.start,
      endIndex: node.markupPosition.end,
    });
  }
}
