import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type TagDefinitionTag } from '../tag-definitions';

export const breakTag: TagDefinitionTag<string> = {
  kind: TagKind.Tag,
  parse(name: string, markup: MarkupParser, _parser: Parser): string {
    if (!markup.isAtEnd()) {
      throw new Error(`'${name}' tag does not accept markup`);
    }
    return '';
  },
};
