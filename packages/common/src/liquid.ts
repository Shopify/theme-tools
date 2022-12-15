import {
  LiquidHtmlNode,
  LiquidHtmlNodeTypes as NodeTypes,
  CheckNodeMethod,
  LiquidCheck,
  LiquidSourceCode,
  SourceCodeType,
} from './types';

function isLiquidHtmlNode(thing: unknown): thing is LiquidHtmlNode {
  return (
    !!thing &&
    typeof thing === 'object' &&
    'type' in thing &&
    !!NodeTypes[thing.type as NodeTypes]
  );
}

function onCheckNodeEnterMethod(
  check: LiquidCheck,
  node: LiquidHtmlNode,
  file: LiquidSourceCode,
): Promise<void> {
  const method = check[node.type] as CheckNodeMethod<
    SourceCodeType.LiquidHtml,
    typeof node.type
  >;
  return method(node, file);
}

function onCheckNodeExitMethod(
  check: LiquidCheck,
  node: LiquidHtmlNode,
  file: LiquidSourceCode,
): Promise<void> {
  const method = check[`${node.type}:exit`] as CheckNodeMethod<
    SourceCodeType.LiquidHtml,
    typeof node.type
  >;
  return method(node, file);
}

export async function visitLiquid(
  node: LiquidHtmlNode,
  check: LiquidCheck,
  file: LiquidSourceCode,
): Promise<void> {
  await onCheckNodeEnterMethod(check, node, file);

  for (const key of Object.keys(node)) {
    if (
      [
        'parentNode',
        'prev',
        'next',
        'firstChild',
        'lastChild',
      ].includes(key)
    ) {
      continue;
    }
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      await Promise.all(
        value
          .filter(isLiquidHtmlNode)
          .map((node: LiquidHtmlNode) =>
            visitLiquid(node, check, file),
          ),
      );
    } else if (isLiquidHtmlNode(value)) {
      await visitLiquid(value, check, file);
    }
  }

  await onCheckNodeExitMethod(check, node, file);
}
