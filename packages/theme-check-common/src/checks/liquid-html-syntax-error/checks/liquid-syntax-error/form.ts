import { NodeTypes, type LiquidArgument, type LiquidTag } from './parser-compat';
import type { Context } from './context';
import {
  argHasBareArrayAccess,
  argHasBareContainsValueExpression,
  hasSingleTerminalComma,
  hasSkippedCharacters,
  rawMarkup,
} from './utils';

const SYNTAX_ERROR = `Syntax error in 'form' tag`;
const BARE_ARRAY_ACCESS = 'Bare bracket access is not allowed in strict2 mode';

export function checkFormTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  const args = node.markup as LiquidArgument[];

  if (args.some(argHasBareArrayAccess)) {
    report(node, context, BARE_ARRAY_ACCESS);
    return;
  }

  if (args.some(argHasBareContainsValueExpression)) {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  if (hasInvalidArgumentOrder(args)) {
    report(node, context, SYNTAX_ERROR);
    return;
  }

  const sourceMarkup = rawMarkup(node);
  if (hasSkippedCharacters(sourceMarkup) || hasSingleTerminalComma(sourceMarkup)) {
    report(node, context, SYNTAX_ERROR);
  }
}

function hasInvalidArgumentOrder(args: LiquidArgument[]): boolean {
  if (args.length === 0 || args[0].type === NodeTypes.NamedArgument) {
    return true;
  }

  let positionalCount = 1;
  let seenNamedArgument = false;

  for (const arg of args.slice(1)) {
    if (arg.type === NodeTypes.NamedArgument) {
      seenNamedArgument = true;
      continue;
    }

    positionalCount += 1;
    if (seenNamedArgument || positionalCount > 2) {
      return true;
    }
  }

  return false;
}

function report(node: LiquidTag, context: Context, message: string): void {
  context.report({
    message,
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
