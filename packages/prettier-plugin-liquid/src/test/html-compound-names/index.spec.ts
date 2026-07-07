import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-compound-names', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
