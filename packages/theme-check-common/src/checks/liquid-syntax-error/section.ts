import type { LiquidTag, SectionMarkup } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import { hasBareArrayAccess, hasSkippedCharacters, rawMarkup, resolveErrorLocation } from './utils';

/*
 * +section+ is a standalone tag, so the parser rejects a stray +endsection+.
 * Ruby Liquid reports that case as an unknown tag, so map the parser error to
 * the same message.
 */
const ENDSECTION_PARSER_ERROR =
  "Attempting to close LiquidTag 'section' before it was opened without a matching 'section'";

export function checkSectionParserError(error: Error, context: Context, source: string): void {
  if (error.message !== ENDSECTION_PARSER_ERROR) return;

  const [startIndex] = resolveErrorLocation(error, source);
  const closeIndex = source.indexOf('%}', startIndex);
  context.report({
    message: "Unknown tag 'endsection'",
    startIndex,
    endIndex: closeIndex === -1 ? source.length : closeIndex + 2,
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
