import {
  AugmentedNode,
  Augment,
  LiquidHtmlNode,
  WithParent,
  WithSiblings,
  isLiquidHtmlNode,
} from '../../types';

export function prev(node: AugmentedNode<WithParent>) {
  if (!node.parentNode) return;
  const collection = parentCollection(node);
  return collection[collection.indexOf(node) - 1];
}

export function next(node: AugmentedNode<WithParent>) {
  if (!node.parentNode) return;
  const collection = parentCollection(node);
  return collection[collection.indexOf(node) + 1];
}

function parentCollection(node: AugmentedNode<WithParent>): AugmentedNode<WithParent>[] {
  if (!node.parentNode) {
    return [];
  }

  for (const key of Object.keys(node.parentNode)) {
    // can't figure out the typing for this and I am done wasting my time.
    const parentValue = (node as any).parentNode[key];
    if (Array.isArray(parentValue)) {
      if (parentValue.indexOf(node) !== -1) {
        return parentValue;
      }
    }

    if (isLiquidHtmlNode(parentValue) && parentValue === node) {
      return [];
    }
  }

  throw new Error('Could not find parent collection of node');
}

export const augmentWithSiblings: Augment<WithParent> = (_options, node) => {
  const augmentations: WithSiblings = {
    next: next(node) as LiquidHtmlNode | undefined,
    prev: prev(node) as LiquidHtmlNode | undefined,
  };

  Object.assign(node, augmentations);
};
