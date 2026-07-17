import type { MarkupParser } from '../markup/parser';
import { TagKind, type TagDefinitionBlock, type Parser } from '../tag-definitions';

export const ifchangedTag: TagDefinitionBlock<null> = {
  kind: TagKind.Block,
  branches: [],
  parse(_name: string, _markup: MarkupParser, _parser: Parser): null {
    // ifchanged takes no markup
    return null;
  },
};
