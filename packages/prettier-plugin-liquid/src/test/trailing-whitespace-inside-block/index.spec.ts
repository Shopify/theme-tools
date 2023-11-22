import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: trailing-whitespace-inside-block', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
