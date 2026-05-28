import type { LiquidTag, LiquidConditionalExpression } from './parser-compat';
import type { Context } from './context';
import {
  conditionalHasBareArrayAccess,
  hasInvalidBooleanExpressionComparisonMarkup,
  hasInvalidBooleanExpressionLexerMarkup,
  hasInvalidBooleanExpressionLookupMarkup,
  hasInvalidBooleanExpressionTokenMarkup,
  hasInvalidBooleanComparisonRhsMarkup,
  hasInvalidBooleanComparisonRhsLookupMarkup,
  hasInvalidComparisonRhsMarkup,
  hasInvalidConditionalLookupMarkup,
  hasInvalidLogicalOperandMarkup,
  hasInvalidStandaloneConditionalLexerMarkup,
  hasInvalidStandaloneConditionalTokenMarkup,
  hasSkippedCharacters,
  hasSkippedPrefixCharacters,
  hasSingleTrailingConditionalToken,
  hasTrailingParsedConditionalMarkup,
  hasUnclosedQuotedString,
  rawMarkup,
} from './utils';

const SYNTAX_ERROR = "Syntax error in 'if' tag";
const LIQUID_SYNTAX_ERROR = `Liquid syntax error: ${SYNTAX_ERROR}`;

export function checkIfTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message:
        hasSingleTrailingConditionalToken(node.markup) ||
        hasInvalidBooleanExpressionComparisonMarkup(node.markup) ||
        hasInvalidBooleanExpressionLexerMarkup(node.markup) ||
        hasInvalidBooleanExpressionLookupMarkup(node.markup) ||
        hasInvalidBooleanExpressionTokenMarkup(node.markup) ||
        hasInvalidBooleanComparisonRhsMarkup(node.markup) ||
        hasInvalidConditionalLookupMarkup(node.markup) ||
        hasInvalidBooleanComparisonRhsLookupMarkup(node.markup) ||
        hasInvalidComparisonRhsMarkup(node.markup) ||
        hasInvalidLogicalOperandMarkup(node.markup) ||
        hasInvalidStandaloneConditionalLexerMarkup(node.markup) ||
        hasInvalidStandaloneConditionalTokenMarkup(node.markup)
          ? LIQUID_SYNTAX_ERROR
          : SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as LiquidConditionalExpression;
  const tagMarkup = rawMarkup(node);

  if (
    hasInvalidBooleanExpressionComparisonMarkup(tagMarkup) ||
    hasInvalidBooleanExpressionLexerMarkup(tagMarkup) ||
    hasInvalidBooleanExpressionLookupMarkup(tagMarkup) ||
    hasInvalidBooleanExpressionTokenMarkup(tagMarkup) ||
    hasInvalidBooleanComparisonRhsMarkup(tagMarkup) ||
    hasInvalidBooleanComparisonRhsLookupMarkup(tagMarkup) ||
    hasInvalidComparisonRhsMarkup(tagMarkup)
  ) {
    context.report({
      message: LIQUID_SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasInvalidConditionalLookupMarkup(tagMarkup)) {
    context.report({
      message: LIQUID_SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasInvalidStandaloneConditionalTokenMarkup(tagMarkup)) {
    context.report({
      message: LIQUID_SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasUnclosedQuotedString(tagMarkup)) {
    context.report({
      message: SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (conditionalHasBareArrayAccess(markup)) {
    context.report({
      message: 'Bare bracket access is not allowed in strict2 mode',
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasSkippedPrefixCharacters(node.source, node.markupPosition.start, markup.position.start)) {
    context.report({
      message: SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const parsedMarkup = node.source.slice(markup.position.start, node.markupPosition.end);
  if (hasSkippedCharacters(parsedMarkup)) {
    context.report({
      message:
        hasInvalidConditionalLookupMarkup(parsedMarkup) ||
        hasInvalidBooleanExpressionComparisonMarkup(parsedMarkup) ||
        hasInvalidBooleanExpressionLexerMarkup(parsedMarkup) ||
        hasInvalidBooleanExpressionLookupMarkup(parsedMarkup) ||
        hasInvalidBooleanExpressionTokenMarkup(parsedMarkup) ||
        hasInvalidBooleanComparisonRhsMarkup(parsedMarkup) ||
        hasInvalidBooleanComparisonRhsLookupMarkup(parsedMarkup) ||
        hasInvalidComparisonRhsMarkup(parsedMarkup) ||
        hasInvalidLogicalOperandMarkup(parsedMarkup) ||
        hasInvalidStandaloneConditionalLexerMarkup(parsedMarkup) ||
        hasInvalidStandaloneConditionalTokenMarkup(parsedMarkup)
          ? LIQUID_SYNTAX_ERROR
          : SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (
    hasTrailingParsedConditionalMarkup(node.source, markup.position.end, node.markupPosition.end)
  ) {
    context.report({
      message: LIQUID_SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
