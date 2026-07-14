import type { ContentForMarkup, LiquidNamedArgument } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionTag, type Parser } from '../tag-definitions';

export const contentForTag: TagDefinitionTag<ContentForMarkup> = {
  kind: TagKind.Tag,
  parse(_name: string, markup: MarkupParser, _parser: Parser): ContentForMarkup {
    const contentForType = markup.valueExpression();
    if (contentForType.type !== NodeTypes.String) {
      throw new Error(`Expected string for content_for type, got ${contentForType.type}`);
    }

    const args: LiquidNamedArgument[] = [];
    if (markup.consumeOptional(MarkupTokenType.Comma)) {
      args.push(...markup.namedArguments());
    }

    return {
      type: NodeTypes.ContentForMarkup,
      contentForType,
      args,
      position: { start: contentForType.position.start, end: markup.peek().start },
      source: '',
    };
  },
};
