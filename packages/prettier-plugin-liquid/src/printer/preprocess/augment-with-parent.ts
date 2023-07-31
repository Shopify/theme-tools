import { Augment, ParentNode, WithParent } from '~/types';

export const augmentWithParent: Augment<{}> = (_options, node, parentNode) => {
  const augmentations: WithParent = {
    parentNode: parentNode as ParentNode | undefined,
  };

  Object.assign(node, augmentations);

  // Adding lazy property for debugging. Not added to the
  // types so that we don't use it officially.
  Object.defineProperty(node, '_rawSource', {
    get() {
      return this.source.slice(this.position.start, this.position.end);
    },
  });
};
