import { nonTraversableProperties } from '@shopify/prettier-plugin-liquid/dist/types';
import {
  LiquidHtmlNode,
  LiquidHtmlNodeTypes as NodeTypes,
  CheckNodeMethod,
  LiquidCheck,
  LiquidSourceCode,
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
  file: LiquidSourceCode,
  ancestors: LiquidHtmlNode[] = [],
): Promise<void> {
  const method = check[node.type] as CheckNodeMethod<SourceCodeType.LiquidHtml, typeof node.type>;
  return method(node, file, ancestors);
}

function onCheckNodeExitMethod(
  check: LiquidCheck,
  node: LiquidHtmlNode,
  file: LiquidSourceCode,
  ancestors: LiquidHtmlNode[] = [],
): Promise<void> {
  const method = check[`${node.type}:exit`] as CheckNodeMethod<
    SourceCodeType.LiquidHtml,
    typeof node.type
  >;
  return method(node, file, ancestors);
}

export async function visitLiquid(
  node: LiquidHtmlNode,
  check: LiquidCheck,
  file: LiquidSourceCode,
  ancestors: LiquidHtmlNode[] = [],
): Promise<void> {
  await onCheckNodeEnterMethod(check, node, file, ancestors);
  const lineage = ancestors.concat(node);

  for (const [key, value] of Object.entries(node)) {
    if (nonTraversableProperties.has(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      await Promise.all(
        value
          .filter(isLiquidHtmlNode)
          .map((node: LiquidHtmlNode) => visitLiquid(node, check, file, lineage)),
      );
    } else if (isLiquidHtmlNode(value)) {
      await visitLiquid(value, check, file, lineage);
    }
  }

  await onCheckNodeExitMethod(check, node, file, ancestors);
}
