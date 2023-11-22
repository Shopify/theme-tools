import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: html-raw-nodes-whitespace-borrowing', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
