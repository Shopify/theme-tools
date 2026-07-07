import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: trailing-whitespace-inside-default-branch', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
