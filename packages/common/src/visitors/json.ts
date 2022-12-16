import { JSONNode, CheckNodeMethod, JSONCheck, JSONSourceCode, SourceCodeType } from '../types';

function isJSONNode(thing: unknown): thing is JSONNode {
  return !!thing && typeof thing === 'object' && 'type' in thing;
}

function onCheckNodeEnterMethod(
  check: JSONCheck,
  node: JSONNode,
  file: JSONSourceCode,
  ancestors: JSONNode[],
): Promise<void> {
  const method = check[node.type] as CheckNodeMethod<SourceCodeType.JSON, typeof node.type>;
  return method(node, file, ancestors);
}

function onCheckNodeExitMethod(
  check: JSONCheck,
  node: JSONNode,
  file: JSONSourceCode,
  ancestors: JSONNode[],
): Promise<void> {
  const method = check[`${node.type}:exit`] as CheckNodeMethod<
    SourceCodeType.JSON,
    typeof node.type
  >;
  return method(node, file, ancestors);
}

const nonTraversableProperties = new Set(['loc']);

export async function visitJSON(
  node: JSONNode,
  check: JSONCheck,
  file: JSONSourceCode,
  ancestors: JSONNode[] = [],
): Promise<void> {
  await onCheckNodeEnterMethod(check, node, file, ancestors);
  const lineage = ancestors.concat(node);

  for (const [key, value] of Object.entries(node)) {
    if (nonTraversableProperties.has(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      await Promise.all(
        value.filter(isJSONNode).map((node: JSONNode) => visitJSON(node, check, file, lineage)),
      );
    } else if (isJSONNode(value)) {
      await visitJSON(value, check, file, lineage);
    }
  }

  await onCheckNodeExitMethod(check, node, file, ancestors);
}
