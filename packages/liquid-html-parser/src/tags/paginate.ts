import type { PaginateMarkup, LiquidNamedArgument } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionBlock, type Parser } from '../tag-definitions';

export const paginateTag: TagDefinitionBlock<PaginateMarkup> = {
  kind: TagKind.Block,
  branches: [],
  parse(_name: string, markup: MarkupParser, _parser: Parser): PaginateMarkup {
    const collection = markup.valueExpression();

    if (!markup.id('by')) {
      throw new Error("Expected 'by' in paginate tag");
    }

    const pageSize = markup.valueExpression();

    const args: LiquidNamedArgument[] = [];
    if (markup.consumeOptional(MarkupTokenType.Comma)) {
      args.push(...markup.namedArguments());
    }

    return {
      type: NodeTypes.PaginateMarkup,
      collection,
      pageSize,
      args,
      position: { start: collection.position.start, end: markup.peek().start },
      source: collection.source,
    };
  },
};
