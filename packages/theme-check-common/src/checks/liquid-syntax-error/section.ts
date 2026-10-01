import type { LiquidTag, SectionMarkup } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import { hasBareArrayAccess, hasSkippedCharacters, rawMarkup } from './utils';

/*
 * +section+ is a standalone tag, so +{% endsection %}+ parses as an unknown
 * tag. Ruby Liquid reports it the same way.
 */
export function checkEndsectionTag(node: LiquidTag, context: Context): void {
  context.report({
    message: "Unknown tag 'endsection'",
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}

export function checkSectionTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: `Syntax error in 'section' tag`,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  const markup = node.markup as SectionMarkup;

  /*
   * A +BlockArrayLiteral+ value (e.g. +size: [1, 2]+) is a first-class array
   * literal in this parser, not a bare bracket lookup, so it never counts as
   * bare array access. Skip it to narrow +arg.value+ down to the plain
   * +LiquidExpression+ that +hasBareArrayAccess+ expects.
   */
  if (
    markup.args.some(
      (arg) => arg.value.type !== 'BlockArrayLiteral' && hasBareArrayAccess(arg.value),
    )
  ) {
    context.report({
      message: 'Bare bracket access is not allowed in strict2 mode',
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
