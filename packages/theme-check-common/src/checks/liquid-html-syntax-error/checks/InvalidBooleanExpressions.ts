import { LiquidBooleanExpression, LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
import { INVALID_SYNTAX_MESSAGE } from './utils';
import { isWithinRawTagThatDoesNotParseItsContents } from '../../utils';

export function detectInvalidBooleanExpressions(
  node: LiquidBooleanExpression,
  ancestors: LiquidHtmlNode[],
): Problem<SourceCodeType.LiquidHtml> | undefined {
  if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;

  const condition = node.condition;
  if (condition.type !== NodeTypes.Comparison && condition.type !== NodeTypes.LogicalExpression) {
    return;
  }

  return {
    message: INVALID_SYNTAX_MESSAGE,
    startIndex: node.position.start,
    endIndex: node.position.end,
    fix: (corrector) => {
      corrector.replace(
        node.position.start,
        node.position.end,
        node.source.slice(condition.left.position.start, condition.left.position.end),
      );
    },
  };
}
