import { augmentWithCSSProperties } from './augment-with-css-properties';
import { augmentWithFamily } from './augment-with-family';
import { augmentWithParent } from './augment-with-parent';
import { augmentWithSiblings } from './augment-with-siblings';
import { augmentWithWhitespaceHelpers } from './augment-with-whitespace-helpers';

export const AUGMENTATION_PIPELINE = [
  augmentWithParent,
  augmentWithSiblings,
  augmentWithFamily,
  augmentWithCSSProperties,
  augmentWithWhitespaceHelpers,
];
