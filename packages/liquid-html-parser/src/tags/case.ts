import type { LiquidExpression } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { TagKind, type TagDefinitionBlock, type Parser } from '../tag-definitions';
import { NodeTypes } from '../types';

export const caseTag: TagDefinitionBlock<LiquidExpression> = {
  kind: TagKind.Block,
  branches: ['when', 'else'],
  parse(_name: string, markup: MarkupParser, _parser: Parser): LiquidExpression {
    return markup.valueExpression();
  },
};

/** Branch parse function for {% when val1, val2 or val3 %}. Used by Parser in Phase 3. */
export function whenBranchParse(_name: string, markup: MarkupParser): LiquidExpression[] {
  const values: LiquidExpression[] = [markup.valueExpression()];

  while (true) {
    if (markup.consumeOptional(MarkupTokenType.Comma)) {
      // Lax: Ruby `WhenSyntax` (`case.rb:27`) only continues the value list when
      // a `,`/`or` separator is FOLLOWED by another QuotedFragment; a trailing
      // separator with no following value (`when 1,` / `when 1 or`) leaves
      // `Regexp.last_match(2)` nil, so `parse_lax_when` (`case.rb:132-143`) keeps
      // the values parsed so far and ends the loop. Mirror that ONLY on the lax
      // render path: when no value follows the consumed separator, break and let
      // the `isLax() && !isAtEnd()` discard below swallow the residual. Strict
      // parsing never sets `lax` (DD-7), so `valueExpression()` still throws on
      // the empty value → the document layer's raw-string fallback is preserved
      // and the strict AST / theme-check output is unchanged.
      if (markup.isLax() && !markup.atValueStart()) break;
      values.push(markup.valueExpression());
      continue;
    }

    const token = markup.peek();
    if (token.type === MarkupTokenType.Logical && token.value === 'or') {
      markup.consume(MarkupTokenType.Logical);
      if (markup.isLax() && !markup.atValueStart()) break;
      values.push(markup.valueExpression());
      continue;
    }

    break;
  }

  const trailingColon = markup.peek();
  const lastValue = values[values.length - 1];
  if (
    trailingColon.type === MarkupTokenType.Colon &&
    markup.look(MarkupTokenType.EndOfString, 1) &&
    lastValue.type === NodeTypes.String &&
    lastValue.position.end === trailingColon.start
  ) {
    markup.consume(MarkupTokenType.Colon);
  }

  // Lax: Ruby `WhenSyntax` (`case.rb:27`) captures the first space-separated
  // QuotedFragment per value and continues only on `or`/comma; a bare trailing
  // word after a complete when-value (`when 1 bar`) matches neither, so Ruby's
  // `parse_lax_when` (`case.rb:132-143`) silently drops it (`Regexp.last_match(2)`
  // is nil → loop ends). Mirror that drop ONLY on the lax render path so the
  // residual trailing token does not force the document layer's raw-string
  // fallback. Strict parsing never sets `lax` (DD-7), so `parseBranchMarkup`
  // still sees `!isAtEnd()` and keeps the raw-string fallback — the strict AST /
  // theme-check output is unchanged. (A contiguous `=>bar` is already folded
  // into the preceding lookup by `variableLookup`'s lax separator recovery, so
  // only genuine whitespace-separated trailing words reach here.)
  if (markup.isLax() && !markup.isAtEnd()) {
    markup.discardTrailing();
  }

  return values;
}
