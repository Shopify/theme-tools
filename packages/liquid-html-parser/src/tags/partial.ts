import type { LiquidString } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type TagDefinitionBlock } from '../tag-definitions';
import { NodeTypes } from '../types';

export const partialTag: TagDefinitionBlock<LiquidString> = {
  kind: TagKind.Block,
  branches: [],
  parse(_name: string, markup: MarkupParser, _parser: Parser): LiquidString {
    const expr = markup.valueExpression();
    if (expr.type !== NodeTypes.String) {
      throw new Error(`Expected string for partial name, got ${expr.type}`);
    }
    return expr;
  },
};
