import type { LiquidVariableLookup } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type TagDefinitionTag } from '../tag-definitions';

export const decrementTag: TagDefinitionTag<LiquidVariableLookup> = {
  kind: TagKind.Tag,
  parse(_name: string, markup: MarkupParser, _parser: Parser): LiquidVariableLookup {
    return markup.variableLookup();
  },
};
