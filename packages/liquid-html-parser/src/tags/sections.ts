import type { LiquidString } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionTag, type Parser } from '../tag-definitions';

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
