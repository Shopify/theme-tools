import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-style-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
