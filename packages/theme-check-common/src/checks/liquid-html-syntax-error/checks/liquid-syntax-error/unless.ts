import type { LiquidTag, LiquidConditionalExpression } from './parser-compat';
import type { Context } from './context';
import {
  analyzeMarkup,
  conditionalHasBareArrayAccess,
  hasBooleanExpressionLiquidSyntaxError,
  hasConditionalLiquidSyntaxError,
  hasInvalidConditionalLookupMarkup,
  hasInvalidStandaloneConditionalTokenMarkup,
  hasRubyAcceptedWhitespaceSeparatedQuotePrefix,
  hasSkippedCharacters,
  hasSkippedPrefixCharacters,
  hasSingleTrailingConditionalToken,
  hasTrailingParsedConditionalMarkup,
  hasUnclosedQuotedString,
  rawMarkup,
} from './utils';

const SYNTAX_ERROR = "Syntax error in 'unless' tag";
const LIQUID_SYNTAX_ERROR = `Liquid syntax error: ${SYNTAX_ERROR}`;

export function checkUnlessTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    const markupAnalysis = analyzeMarkup(node.markup);

    context.report({
      message:
        hasSingleTrailingConditionalToken(markupAnalysis) ||
        hasConditionalLiquidSyntaxError(markupAnalysis)
          ? LIQUID_SYNTAX_ERROR
          : SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const source = node.source;
  const markup = node.markup as LiquidConditionalExpression;
  const tagMarkup = rawMarkup(node);
  const tagMarkupAnalysis = analyzeMarkup(tagMarkup);
  const skippedPrefix = source.slice(node.markupPosition.start, markup.position.start);

  if (hasBooleanExpressionLiquidSyntaxError(tagMarkupAnalysis)) {
    context.report({
      message: LIQUID_SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasInvalidConditionalLookupMarkup(tagMarkupAnalysis)) {
    context.report({
      message: LIQUID_SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasInvalidStandaloneConditionalTokenMarkup(tagMarkupAnalysis)) {
    context.report({
      message: LIQUID_SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (
    hasUnclosedQuotedString(tagMarkupAnalysis) &&
    !hasRubyAcceptedWhitespaceSeparatedQuotePrefix(skippedPrefix)
  ) {
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

  if (hasSkippedPrefixCharacters(source, node.markupPosition.start, markup.position.start)) {
    context.report({
      message: SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const parsedMarkup = source.slice(markup.position.start, node.markupPosition.end);
  const parsedMarkupAnalysis = analyzeMarkup(parsedMarkup);
  if (hasSkippedCharacters(parsedMarkupAnalysis)) {
    context.report({
      message: hasConditionalLiquidSyntaxError(parsedMarkupAnalysis)
        ? LIQUID_SYNTAX_ERROR
        : SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasTrailingParsedConditionalMarkup(source, markup.position.end, node.markupPosition.end)) {
    context.report({
      message: LIQUID_SYNTAX_ERROR,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}
