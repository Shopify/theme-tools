import type { LiquidString } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type TagDefinitionTag } from '../tag-definitions';
import { NodeTypes } from '../types';

export const sectionsTag: TagDefinitionTag<LiquidString> = {
  kind: TagKind.Tag,
  parse(_name: string, markup: MarkupParser, _parser: Parser): LiquidString {
    const expr = markup.valueExpression();
    if (expr.type !== NodeTypes.String) {
      throw new Error(`Expected string for sections name, got ${expr.type}`);
    }
    return expr;
  },
};
