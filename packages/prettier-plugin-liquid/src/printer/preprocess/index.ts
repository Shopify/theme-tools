import { augmentWithCSSProperties } from './augment-with-css-properties';
import { augmentWithParent } from './augment-with-parent';
import { augmentWithSiblings } from './augment-with-siblings';
import { augmentWithWhitespaceHelpers } from './augment-with-whitespace-helpers';
import { augmentWithFamily } from './augment-with-family';

export const AUGMENTATION_PIPELINE = [
  augmentWithParent,
  augmentWithSiblings,
  augmentWithFamily,
  augmentWithCSSProperties,
  augmentWithWhitespaceHelpers,
];
