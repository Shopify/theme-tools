import type { LiquidExpression } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type TagDefinitionTag } from '../tag-definitions';

export const layoutTag: TagDefinitionTag<LiquidExpression> = {
  kind: TagKind.Tag,
  parse(_name: string, markup: MarkupParser, _parser: Parser): LiquidExpression {
    return markup.valueExpression();
  },
};
