import type { LiquidArgument } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type TagDefinitionBlock } from '../tag-definitions';

export const formTag: TagDefinitionBlock<LiquidArgument[]> = {
  kind: TagKind.Block,
  branches: [],
  parse(_name: string, markup: MarkupParser, _parser: Parser): LiquidArgument[] {
    return markup.arguments();
  },
};
