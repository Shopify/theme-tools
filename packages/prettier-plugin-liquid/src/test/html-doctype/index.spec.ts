import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-doctype', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
