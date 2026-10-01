import { nonTraversableProperties } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, LiquidCheck } from '../types';

function isLiquidHtmlNode(thing: unknown): thing is LiquidHtmlNode {
  return !!thing && typeof thing === 'object' && 'type' in thing;
}

/**
 * Walks the AST, calling `visit` with the name of the check method for each node: its type on the
 * way down, then `${type}:exit` once its children are queued. Waits for `visit` when it returns a
 * promise.
 */
export async function visitLiquid(
  node: LiquidHtmlNode,
  visit: (
    method: keyof LiquidCheck,
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ) => Promise<unknown> | undefined,
): Promise<void> {
  const stack: { node: LiquidHtmlNode; ancestors: LiquidHtmlNode[] }[] = [{ node, ancestors: [] }];
  let visiting: Promise<unknown> | undefined;

  while (stack.length > 0) {
    const { node, ancestors } = stack.pop()!;
    const lineage = ancestors.concat(node);

    visiting = visit(node.type, node, ancestors);
    if (visiting) await visiting;

    for (const key in node) {
      if (!node.hasOwnProperty(key) || nonTraversableProperties.has(key)) {
        continue;
      }

      const value = node[key as keyof LiquidHtmlNode];
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) {
          const item = value[i];
          if (isLiquidHtmlNode(item)) {
            stack.push({ node: item, ancestors: lineage });
          }
        }
      } else if (isLiquidHtmlNode(value)) {
        stack.push({ node: value, ancestors: lineage });
      }
    }

    visiting = visit(`${node.type}:exit`, node, ancestors);
    if (visiting) await visiting;
  }
}
