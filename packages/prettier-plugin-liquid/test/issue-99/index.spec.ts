import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

describe(`Unit: ${path.basename(__dirname)}`, () => {
  assertFormattedEqualsFixed(__dirname);
});
