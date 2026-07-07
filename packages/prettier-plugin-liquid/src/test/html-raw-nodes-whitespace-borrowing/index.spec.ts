import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-raw-nodes-whitespace-borrowing', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
