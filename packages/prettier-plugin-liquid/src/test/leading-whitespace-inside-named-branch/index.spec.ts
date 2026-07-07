import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: leading-whitespace-inside-named-branch', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
