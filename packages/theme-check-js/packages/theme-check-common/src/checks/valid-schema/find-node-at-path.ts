import { PropertyNode, ValueNode } from 'json-to-ast';
import { isArrayNode, isObjectNode, isPropertyNode } from '../../types';

/**
 * Returns the node in a list of nodes that matches the path.
 * This supports cases where the path is an index or a key.
 */
const findNodeByPath = (nodes: Array<ValueNode | PropertyNode>, path: string) => {
  const numPath = Number(path);
  const isIndexPath = !isNaN(numPath);

  if (isIndexPath && nodes.length > numPath) {
    return nodes[numPath];
  }

  return nodes.find((child) => isPropertyNode(child) && child.key.value === path);
};

/**
 * Traverse the JSON AST to find the node corresponding to the path
 */
export const findNodeAtPath = (
  node: ValueNode,
  pathSegments: string[],
): ValueNode | PropertyNode | undefined => {
  const [segment, ...remainingSegments] = pathSegments;

  if (isObjectNode(node) || isArrayNode(node)) {
    const nodeChildren = node.children as Array<ValueNode | PropertyNode>;
    const subNode = findNodeByPath(nodeChildren, segment);
    if (subNode && remainingSegments.length > 0) {
      return findNodeAtPath(isPropertyNode(subNode) ? subNode.value : subNode, remainingSegments);
    }

    return subNode;
  }

  return undefined;
};
