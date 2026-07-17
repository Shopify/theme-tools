import type { LiquidConditionalExpression } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { TagKind, type TagDefinitionBlock, type Parser } from '../tag-definitions';

function parseConditionalExpression(
  _name: string,
  markup: MarkupParser,
  _parser: Parser,
): LiquidConditionalExpression {
  return markup.conditionalExpression();
}

export const ifTag: TagDefinitionBlock<LiquidConditionalExpression> = {
  kind: TagKind.Block,
  branches: ['elsif', 'else'],
  parse: parseConditionalExpression,
};

export const unlessTag: TagDefinitionBlock<LiquidConditionalExpression> = {
  kind: TagKind.Block,
  branches: ['elsif', 'else'],
  parse: parseConditionalExpression,
};

/** Branch parse function for {% elsif condition %}. Used by Parser in Phase 3. */
export function elsifBranchParse(_name: string, markup: MarkupParser): LiquidConditionalExpression {
  return markup.conditionalExpression();
}
