import {
  NodeTypes,
  type BlockMarkup,
  type LiquidTag,
  type Position,
} from '@shopify/liquid-html-parser';
import type { Context } from '.';
import {
  hasBareArrayAccess,
  hasSkippedCharacters,
  liquidLineTagLocation,
  rawMarkup,
  resolveErrorLocation,
} from './utils';

const SYNTAX_ERROR = "Syntax error in 'block' tag";
const BARE_ARRAY_ACCESS = 'Bare bracket access is not allowed in strict2 mode';
const DOTTED_ARGUMENT =
  "Liquid syntax error: in 'block' - Use plain named arguments, for example: block 'name', heading: value";
const UNCLOSED_BLOCK_PARSER_ERROR = "Attempting to end parsing before LiquidTag 'block' was closed";
const UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR = "Unclosed block tag 'block' in {% liquid %} block";
const BLOCK_PARSER_ERROR_MESSAGES = new Set([
  UNCLOSED_BLOCK_PARSER_ERROR,
  UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR,
  "Attempting to close LiquidTag 'block' before it was opened without a matching 'block'",
]);

interface BlockTagSyntaxOffense {
  message: string;
  position: Position;
}

export function checkBlockTag(node: LiquidTag, context: Context): void {
  const offense = blockTagSyntaxOffense(node);
  if (!offense) return;

  context.report({
    message: offense.message,
    startIndex: offense.position.start,
    endIndex: offense.position.end,
  });
}

export function blockTagSyntaxError(node: LiquidTag): string | undefined {
  return blockTagSyntaxOffense(node)?.message;
}

export function checkBlockParserError(error: Error, context: Context, source: string): void {
  if (!BLOCK_PARSER_ERROR_MESSAGES.has(error.message)) return;

  const [startIndex, endIndex] = error.message.includes(
    "Unclosed block tag 'block' in {% liquid %} block",
  )
    ? (liquidLineTagLocation(source, 'block') ?? resolveErrorLocation(error, source))
    : resolveErrorLocation(error, source);

  context.report({
    message:
      error.message === UNCLOSED_BLOCK_PARSER_ERROR
        ? "Liquid syntax error: 'block' tag was never closed"
        : error.message,
    startIndex,
    endIndex,
  });
}

function blockTagSyntaxOffense(node: LiquidTag): BlockTagSyntaxOffense | undefined {
  if (typeof node.markup === 'string') return tagOffense(node, SYNTAX_ERROR);

  const markup = node.markup as BlockMarkup;

  if (hasInvalidBlockName(markup.name.value)) {
    return tagOffense(node, "Liquid syntax error: in 'block' - Valid syntax: block '[file_name]'");
  }

  /*
   * Ruby Liquid still accepts the unsupported experimental block.settings.<id>
   * and block.content caller forms. Theme Check intentionally rejects every
   * dotted argument except block.name so authors move to plain arguments.
   * Report the first one so body-form children stay outside the offense.
   */
  const dottedArgument = markup.args.find(isDottedArgument);
  if (dottedArgument) return { message: DOTTED_ARGUMENT, position: dottedArgument.position };

  if (markup.args.some(isInvalidBlockNameArgument)) return tagOffense(node, SYNTAX_ERROR);

  /*
   * A +BlockArrayLiteral+ value (e.g. +size: [1, 2]+) is a first-class array
   * literal in this parser, not a bare bracket lookup, so it never counts as
   * bare array access. Skip it to narrow +arg.value+ down to the plain
   * +LiquidExpression+ that +hasBareArrayAccess+ expects.
   */
  if (
    markup.args.some(
      (arg) => arg.value.type !== 'BlockArrayLiteral' && hasBareArrayAccess(arg.value),
    )
  ) {
    return tagOffense(node, BARE_ARRAY_ACCESS);
  }

  if (hasSkippedCharacters(rawMarkup(node))) return tagOffense(node, SYNTAX_ERROR);
}

function tagOffense(node: LiquidTag, message: string): BlockTagSyntaxOffense {
  return { message, position: node.position };
}

function hasInvalidBlockName(value: string): boolean {
  return value.includes('/') || value.includes('.');
}

function isInvalidBlockNameArgument(argument: BlockMarkup['args'][number]): boolean {
  return argument.name === 'block.name' && argument.value.type !== NodeTypes.String;
}

function isDottedArgument(argument: BlockMarkup['args'][number]): boolean {
  return argument.name !== 'block.name' && argument.name.includes('.');
}
