import type { SectionMarkup } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionHybrid, type Parser } from '../tag-definitions';

export const sectionTag: TagDefinitionHybrid<SectionMarkup> = {
  kind: TagKind.Hybrid,
  parse(_name: string, markup: MarkupParser, _parser: Parser): SectionMarkup {
    const name = markup.valueExpression();
    if (name.type !== NodeTypes.String) {
      throw new Error(`Expected string for section name, got ${name.type}`);
    }

    const args: SectionMarkup['args'] = [];
    if (markup.consumeOptional(MarkupTokenType.Comma)) {
      args.push(...markup.blockNamedArguments());
    }

    return {
      type: NodeTypes.SectionMarkup,
      name,
      args,
      position: { start: name.position.start, end: markup.peek().start },
      source: name.source,
    };
  },
};
