import { LiquidBooleanExpression, LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
import { INVALID_SYNTAX_MESSAGE } from './utils';

export function detectInvalidBooleanExpressions(
  node: LiquidBooleanExpression,
  ancestors: LiquidHtmlNode[],
): Problem<SourceCodeType.LiquidHtml> | undefined {
  const condition = node.condition;

  // We are okay with boolean expressions in schema tags (specifically for visible_if)
  if (
    ancestors.some(
      (ancestor) => ancestor.type === NodeTypes.LiquidRawTag && ancestor.name === 'schema',
    )
  ) {
    return;
  }

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
