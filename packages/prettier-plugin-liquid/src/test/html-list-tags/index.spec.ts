import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-list-tags', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
