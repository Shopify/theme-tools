import { type LiquidVariableOutput } from './parser-compat';
import {
  hasEmptyMarkup,
  hasRubyAcceptedEmptyFirstFilterArgument,
  hasSkippedCharacters,
  hasUnclosedQuotedString,
  variableHasBareArrayAccess,
  variableHasBareContainsValueExpression,
} from './utils';
import type { Context } from './context';

export function checkVariableOutput(node: LiquidVariableOutput, context: Context): void {
  const rawMarkup = node.source.slice(node.markupPosition.start, node.markupPosition.end);

  if (typeof node.markup === 'string') {
    if (hasEmptyMarkup(rawMarkup)) return;
    if (hasRubyAcceptedEmptyFirstFilterArgument(node.markup)) return;

    context.report({
      message: 'Syntax error in variable output',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup;

  if (hasRubyAcceptedEmptyFirstFilterArgument(rawMarkup)) return;

  if (hasUnclosedQuotedString(rawMarkup)) {
    context.report({
      message: 'Syntax error in variable output',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (variableHasBareArrayAccess(markup)) {
    context.report({
      message: 'Bare bracket access is not allowed in strict2 mode',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (variableHasBareContainsValueExpression(markup)) {
    context.report({
      message: 'Syntax error in variable output',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedCharacters(rawMarkup)) {
    context.report({
      message: 'Syntax error in variable output',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
