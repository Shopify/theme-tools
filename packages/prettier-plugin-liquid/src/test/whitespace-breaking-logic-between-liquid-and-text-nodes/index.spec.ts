import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: whitespace-breaking-logic-between-liquid-and-text-nodes', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
