import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: issue-154', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
