import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-comment', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
