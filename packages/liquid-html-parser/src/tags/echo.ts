import type { LiquidVariable } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type TagDefinitionTag } from '../tag-definitions';

export const echoTag: TagDefinitionTag<LiquidVariable> = {
  kind: TagKind.Tag,
  parse(_name: string, markup: MarkupParser, _parser: Parser): LiquidVariable {
    return markup.liquidVariable();
  },
};
