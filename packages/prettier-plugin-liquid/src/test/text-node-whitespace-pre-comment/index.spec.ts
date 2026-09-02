import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: text-node-whitespace-pre-comment', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
