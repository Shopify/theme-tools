import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import { Check, Context, SourceCodeType } from '../../..';
import { INVALID_SYNTAX_MESSAGE } from './utils';

export function detectInvalidBooleanExpressions(
  context: Context<SourceCodeType.LiquidHtml>,
): Check<SourceCodeType.LiquidHtml> {
  return {
    async BooleanExpression(node, ancestors) {
      const condition = node.condition;

      // We are okay with boolean expressions in schema tags (specifically for visible_if)
      if (
        ancestors.some(
          (ancestor) => ancestor.type === NodeTypes.LiquidRawTag && ancestor.name === 'schema',
        )
      ) {
        return;
      }

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
