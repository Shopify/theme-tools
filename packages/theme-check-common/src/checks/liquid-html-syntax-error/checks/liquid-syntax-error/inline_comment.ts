import type { LiquidTag } from './parser-compat';
import type { Context } from './context';
import { hasRubyValidInlineCommentMarkup, rawMarkup } from './utils';

export function checkInlineCommentTag(node: LiquidTag, context: Context): void {
  if (hasRubyValidInlineCommentMarkup(rawMarkup(node))) return;

  context.report({
    message:
      "Syntax error in tag '#' - Each line of comments must be prefixed by the '#' character",
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
