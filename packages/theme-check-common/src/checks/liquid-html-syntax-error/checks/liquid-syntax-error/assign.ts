import type { LiquidTag, AssignMarkup } from './parser-compat';
import type { Context } from './context';
import {
  variableHasBareArrayAccess,
  hasSkippedCharacters,
  hasSkippedPrefixCharacters,
  hasRubyAcceptedEmptyFirstFilterArgument,
  hasRubyAcceptedEmptyAssignRhs,
  hasRubyAcceptedAssignLhsExtraIdentifier,
  hasRubyAcceptedAssignLhsUnclosedQuote,
  variableHasBareContainsValueExpression,
  rawMarkup,
} from './utils';

export function checkAssignTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    if (hasRubyAcceptedEmptyAssignRhs(node.markup)) return;
    if (hasRubyAcceptedEmptyFirstFilterArgument(node.markup)) return;
    if (hasRubyAcceptedAssignLhsExtraIdentifier(node.markup)) return;
    if (hasRubyAcceptedAssignLhsUnclosedQuote(node.markup)) return;

    context.report({
      message: `Syntax error in 'assign' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as AssignMarkup;

  if (variableHasBareArrayAccess(markup.value)) {
    context.report({
      message: 'Bare bracket access is not allowed',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (variableHasBareContainsValueExpression(markup.value)) {
    context.report({
      message: `Syntax error in 'assign' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedPrefixCharacters(node.source, node.markupPosition.start, markup.position.start)) {
    context.report({
      message: `Syntax error in 'assign' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const raw = rawMarkup(node);
  if (hasRubyAcceptedEmptyAssignRhs(raw)) return;
  if (hasRubyAcceptedEmptyFirstFilterArgument(raw)) return;
  if (hasRubyAcceptedAssignLhsExtraIdentifier(raw)) return;
  if (hasRubyAcceptedAssignLhsUnclosedQuote(raw)) return;

  const parsedRaw = node.source.slice(markup.position.start, node.markupPosition.end);
  if (hasSkippedCharacters(parsedRaw)) {
    context.report({
      message: `Syntax error in 'assign' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
