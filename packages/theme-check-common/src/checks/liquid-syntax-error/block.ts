import {
  NodeTypes,
  type BlockArgumentValue,
  type BlockMarkup,
  type LiquidTag,
  type Position,
} from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../types';
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
const APP_BLOCK_CONTENT = "Liquid syntax error: in 'block' - app blocks do not accept content";
const UNCLOSED_BLOCK_PARSER_ERROR = "Attempting to end parsing before LiquidTag 'block' was closed";
const UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR = "Unclosed block tag 'block' in {% liquid %} block";
const BLOCK_PARSER_ERROR_MESSAGES = new Set([
  UNCLOSED_BLOCK_PARSER_ERROR,
  UNCLOSED_BLOCK_IN_LIQUID_PARSER_ERROR,
  "Attempting to close LiquidTag 'block' before it was opened without a matching 'block'",
]);

export function checkBlockTag(node: LiquidTag, context: Context): void {
  const problem = blockTagSyntaxError(node);
  if (problem) context.report(problem);
}

export function blockTagSyntaxError(
  node: LiquidTag,
): Problem<SourceCodeType.LiquidHtml> | undefined {
  if (typeof node.markup === 'string') return syntaxProblem(node.position, SYNTAX_ERROR);

  const markup = node.markup as BlockMarkup;

  /*
   * Ruby Liquid still accepts the unsupported experimental block.settings.<id>
   * and block.content caller forms. Theme Check intentionally rejects every
   * dotted argument except block.name so authors move to plain arguments.
   * Report the first one so body-form children stay outside the offense.
   */
  const dottedArgument = markup.args.find(isDottedArgument);
  if (dottedArgument) {
    return syntaxProblem(dottedArgument.position, dottedArgumentMessage(dottedArgument.name));
  }

  /*
   * App settings map to JSON settings: only fixed scalars or flat arrays of
   * them are allowed. Check every occurrence so a later fixed duplicate does
   * not hide an earlier expression. block.name is metadata, not a setting.
   */
  if (isAppBlockPath(markup.name.value)) {
    const dynamicArgument = markup.args.find(
      (argument) => argument.name !== 'block.name' && !isFixedAppSetting(argument.value),
    );
    if (dynamicArgument) {
      return syntaxProblem(
        node.position,
        `Liquid syntax error: in 'block' - app block settings must be fixed values; '${dynamicArgument.name}' is not a string, number, boolean or array of those`,
      );
    }
    if (hasContent(node)) return syntaxProblem(node.position, APP_BLOCK_CONTENT);
  }

  if (markup.args.some(isInvalidBlockNameArgument)) {
    return syntaxProblem(node.position, SYNTAX_ERROR);
  }

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
    return syntaxProblem(node.position, BARE_ARRAY_ACCESS);
  }

  if (hasSkippedCharacters(rawMarkup(node))) return syntaxProblem(node.position, SYNTAX_ERROR);
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

function syntaxProblem(position: Position, message: string): Problem<SourceCodeType.LiquidHtml> {
  return { message, startIndex: position.start, endIndex: position.end };
}

function isAppBlockPath(value: string): boolean {
  return value.startsWith('shopify://apps/');
}

function isFixedAppSetting(value: BlockArgumentValue): boolean {
  const elements = value.type === 'BlockArrayLiteral' ? value.elements : [value];
  return elements.every(
    (element) =>
      element.type === NodeTypes.String ||
      element.type === NodeTypes.Number ||
      (element.type === NodeTypes.LiquidLiteral &&
        (element.keyword === 'true' || element.keyword === 'false')),
  );
}

function hasContent(node: LiquidTag): boolean {
  return (node.children ?? []).some(
    (child) => child.type !== NodeTypes.TextNode || child.value.trim() !== '',
  );
}

function isInvalidBlockNameArgument(argument: BlockMarkup['args'][number]): boolean {
  return argument.name === 'block.name' && argument.value.type !== NodeTypes.String;
}

function isDottedArgument(argument: BlockMarkup['args'][number]): boolean {
  return argument.name !== 'block.name' && argument.name.includes('.');
}

/*
 * Temporary migration guidance for the experimental block.settings.<id>
 * caller form. Remove it once authors have migrated to plain arguments.
 */
function dottedArgumentMessage(name: string): string {
  const settingId = blockSettingId(name);
  if (!settingId) return DOTTED_ARGUMENT;

  return `Liquid syntax error: in 'block' - Use '${settingId}:' instead of '${name}:' when calling a block.`;
}

function blockSettingId(name: string): string | undefined {
  const [object, property, settingId, ...rest] = name.split('.');
  if (object !== 'block' || property !== 'settings' || rest.length > 0) return undefined;

  return settingId;
}
