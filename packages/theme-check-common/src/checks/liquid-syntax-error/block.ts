import { NodeTypes, type BlockMarkup, type LiquidTag } from '@shopify/liquid-html-parser';
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

export function checkBlockTag(node: LiquidTag, context: Context): void {
  const message = blockTagSyntaxError(node);
  if (message) report(node, context, message);
}

export function blockTagSyntaxError(node: LiquidTag): string | undefined {
  if (typeof node.markup === 'string') return SYNTAX_ERROR;

  const markup = node.markup as BlockMarkup;

  if (hasInvalidBlockName(markup.name.value)) {
    return "Liquid syntax error: in 'block' - Valid syntax: block '[file_name]'";
  }

  /*
   * Ruby Liquid still accepts the unsupported experimental block.settings.<id>
   * and block.content caller forms. Theme Check intentionally rejects every
   * dotted argument except block.name so authors move to plain arguments.
   */
  if (markup.args.some(isDottedArgument)) return DOTTED_ARGUMENT;

  if (markup.args.some(isInvalidBlockNameArgument)) return SYNTAX_ERROR;

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
    return BARE_ARRAY_ACCESS;
  }

  if (hasSkippedCharacters(rawMarkup(node))) return SYNTAX_ERROR;
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

function hasInvalidBlockName(value: string): boolean {
  return value.includes('/') || value.includes('.');
}

function isInvalidBlockNameArgument(argument: BlockMarkup['args'][number]): boolean {
  return argument.name === 'block.name' && argument.value.type !== NodeTypes.String;
}

function isDottedArgument(argument: BlockMarkup['args'][number]): boolean {
  return argument.name !== 'block.name' && argument.name.includes('.');
}

function report(node: LiquidTag, context: Context, message: string): void {
  context.report({
    message,
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
