import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: issue-162', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
