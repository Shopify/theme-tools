import { Augment, LiquidHtmlNode, WithFamily } from '../../types';

export const augmentWithFamily: Augment<{}> = (_options, node) => {
  const children: LiquidHtmlNode[] = (node as any).children || [];
  const augmentations: WithFamily = {
    firstChild: children[0],
    lastChild: children[children.length - 1],
  };

  Object.assign(node, augmentations);
};
