import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Issue 1288: does not add text between adjacent HTML elements', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
