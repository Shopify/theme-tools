import { nonTraversableProperties } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, CheckNodeMethod, LiquidCheck, SourceCodeType } from '../types';

function isLiquidHtmlNode(thing: unknown): thing is LiquidHtmlNode {
  return !!thing && typeof thing === 'object' && 'type' in thing;
}

export async function visitLiquid(node: LiquidHtmlNode, check: LiquidCheck): Promise<void> {
  const stack: { node: LiquidHtmlNode; ancestors: LiquidHtmlNode[] }[] = [{ node, ancestors: [] }];
  let method: CheckNodeMethod<SourceCodeType.LiquidHtml, any> | undefined;

  while (stack.length > 0) {
    const { node, ancestors } = stack.pop()!;
    const lineage = ancestors.concat(node);

    method = check[node.type];
    if (method) await method(node, ancestors);

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

    method = check[`${node.type}:exit`];
    if (method) await method(node, ancestors);
  }
}
