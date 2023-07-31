import { augmentWithCSSProperties } from '~/printer/preprocess/augment-with-css-properties';
import { augmentWithParent } from '~/printer/preprocess/augment-with-parent';
import { augmentWithSiblings } from '~/printer/preprocess/augment-with-siblings';
import { augmentWithWhitespaceHelpers } from '~/printer/preprocess/augment-with-whitespace-helpers';
import { augmentWithFamily } from '~/printer/preprocess/augment-with-family';

export const AUGMENTATION_PIPELINE = [
  augmentWithParent,
  augmentWithSiblings,
  augmentWithFamily,
  augmentWithCSSProperties,
  augmentWithWhitespaceHelpers,
];
