import type { LiquidTag, LiquidVariable } from './parser-compat';
import type { Context } from './context';
import {
  variableHasBareArrayAccess,
  hasEmptyMarkup,
  hasSkippedCharacters,
  rawMarkup,
  hasRubyAcceptedEmptyFirstFilterArgument,
  variableHasBareContainsValueExpression,
} from './utils';

export function checkEchoTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    if (hasEmptyMarkup(rawMarkup(node))) return;
    if (hasRubyAcceptedEmptyFirstFilterArgument(node.markup)) return;

    context.report({
      message: `Syntax error in 'echo' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as LiquidVariable;

  if (variableHasBareArrayAccess(markup)) {
    context.report({
      message: 'Bare bracket access is not allowed',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (variableHasBareContainsValueExpression(markup)) {
    context.report({
      message: `Syntax error in 'echo' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const raw = rawMarkup(node);
  if (hasRubyAcceptedEmptyFirstFilterArgument(raw)) return;

  if (hasSkippedCharacters(raw)) {
    context.report({
      message: `Syntax error in 'echo' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
