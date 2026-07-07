import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: whitespace-breaking-logic-between-liquid-and-text-nodes', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
