import { JSONNode, CheckNodeMethod, JSONCheck, SourceCodeType } from '../types';

function isJSONNode(thing: unknown): thing is JSONNode {
  return !!thing && typeof thing === 'object' && 'type' in thing;
}

const nonTraversableProperties = new Set(['loc']);

export async function visitJSON(node: JSONNode, check: JSONCheck): Promise<void> {
  const stack: { node: JSONNode; ancestors: JSONNode[] }[] = [{ node, ancestors: [] }];
  let method: CheckNodeMethod<SourceCodeType.JSON, any> | undefined;

  while (stack.length > 0) {
    const { node, ancestors } = stack.pop()!;
    const lineage = ancestors.concat(node);

    method = check[node.type];
    if (method) await method(node, ancestors);

    for (const key in node) {
      if (!node.hasOwnProperty(key) || nonTraversableProperties.has(key)) {
        continue;
      }

      const value = node[key as keyof JSONNode];
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) {
          const item = value[i];
          if (isJSONNode(item)) {
            stack.push({ node: item, ancestors: lineage });
          }
        }
      } else if (isJSONNode(value)) {
        stack.push({ node: value, ancestors: lineage });
      }
    }

    method = check[`${node.type}:exit`];
    if (method) await method(node, ancestors);
  }
}
