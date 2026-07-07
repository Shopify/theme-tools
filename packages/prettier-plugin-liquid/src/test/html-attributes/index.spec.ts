import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-attributes', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
