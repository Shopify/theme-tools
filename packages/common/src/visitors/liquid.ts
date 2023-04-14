import { nonTraversableProperties } from '@shopify/prettier-plugin-liquid/dist/types';
import {
  LiquidHtmlNode,
  LiquidHtmlNodeTypes as NodeTypes,
  CheckNodeMethod,
  LiquidCheck,
  SourceCodeType,
} from '../types';

function isLiquidHtmlNode(thing: unknown): thing is LiquidHtmlNode {
  return (
    !!thing && typeof thing === 'object' && 'type' in thing && !!NodeTypes[thing.type as NodeTypes]
  );
}

function onCheckNodeEnterMethod(
  check: LiquidCheck,
  node: LiquidHtmlNode,
  ancestors: LiquidHtmlNode[] = [],
): Promise<void> {
  const method = check[node.type] as CheckNodeMethod<SourceCodeType.LiquidHtml, typeof node.type>;
  return method(node, ancestors);
}

function onCheckNodeExitMethod(
  check: LiquidCheck,
  node: LiquidHtmlNode,
  ancestors: LiquidHtmlNode[] = [],
): Promise<void> {
  const method = check[`${node.type}:exit`] as CheckNodeMethod<
    SourceCodeType.LiquidHtml,
    typeof node.type
  >;
  return method(node, ancestors);
}

export async function visitLiquid(
  node: LiquidHtmlNode,
  check: LiquidCheck,
  ancestors: LiquidHtmlNode[] = [],
): Promise<void> {
  await onCheckNodeEnterMethod(check, node, ancestors);
  const lineage = ancestors.concat(node);

  for (const [key, value] of Object.entries(node)) {
    if (nonTraversableProperties.has(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      await Promise.all(
        value
          .filter(isLiquidHtmlNode)
          .map((node: LiquidHtmlNode) => visitLiquid(node, check, lineage)),
      );
    } else if (isLiquidHtmlNode(value)) {
      await visitLiquid(value, check, lineage);
    }
  }

  await onCheckNodeExitMethod(check, node, ancestors);
}
