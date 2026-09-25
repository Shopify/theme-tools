import type { BlockMarkup, BlockArrayArgument, LiquidNamedArgument } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionBlock, type Parser } from '../tag-definitions';

const BLOCK_TYPE_REGEX = /^_?[a-zA-Z0-9][\w-]*$/;
// Canonical app block paths include app and block handles followed by a UUID.
const APP_BLOCK_TYPE_REGEX =
  /^shopify:\/\/apps\/[A-Za-z0-9][A-Za-z0-9_-]*\/blocks\/[A-Za-z0-9][A-Za-z0-9_-]*\/[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$/;

export const blockTag: TagDefinitionBlock<BlockMarkup> = {
  kind: TagKind.Block,
  branches: [],
  parse(_name: string, markup: MarkupParser, _parser: Parser): BlockMarkup {
    if (markup.isAtEnd()) {
      throw new Error("in 'block' - missing block type");
    }

    const name = markup.valueExpression();
    if (name.type !== NodeTypes.String) {
      throw new Error("in 'block' - file name must be a string literal");
    }
    if (!BLOCK_TYPE_REGEX.test(name.value) && !APP_BLOCK_TYPE_REGEX.test(name.value)) {
      throw new Error(`in 'block' - '${name.value}' is not a valid block type`);
    }

    let args: (LiquidNamedArgument | BlockArrayArgument)[] = [];
    if (markup.consumeOptional(MarkupTokenType.Comma) && !markup.isAtEnd()) {
      args = markup.blockNamedArguments();
    }

    if (!markup.isAtEnd()) {
      const token = markup.peek();
      throw new Error(`Unexpected token in 'block' tag: ${token.value}`);
    }

    return {
      type: NodeTypes.BlockMarkup,
      name,
      args,
      position: { start: name.position.start, end: markup.peek().start },
      source: name.source,
    };
  },
};
