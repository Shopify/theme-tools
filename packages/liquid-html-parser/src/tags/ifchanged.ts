import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type TagDefinitionBlock } from '../tag-definitions';

export const ifchangedTag: TagDefinitionBlock<null> = {
  kind: TagKind.Block,
  branches: [],
  parse(_name: string, _markup: MarkupParser, _parser: Parser): null {
    // ifchanged takes no markup
    return null;
  },
};
