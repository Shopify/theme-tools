import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: trailing-whitespace-inside-default-branch', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
