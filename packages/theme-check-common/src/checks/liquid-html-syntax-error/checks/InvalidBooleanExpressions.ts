import { NodeTypes } from '@shopify/liquid-html-parser';
import { Check, Context, SourceCodeType } from '../../..';
import { INVALID_SYNTAX_MESSAGE } from './utils';

export function detectInvalidBooleanExpressions(
  context: Context<SourceCodeType.LiquidHtml>,
): Check<SourceCodeType.LiquidHtml> {
  return {
    async BooleanExpression(node) {
      const condition = node.condition;

      if (
        condition.type !== NodeTypes.Comparison &&
        condition.type !== NodeTypes.LogicalExpression
      ) {
        return;
      }

      context.report({
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
      });
    },
  };
}
