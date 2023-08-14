import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: issue-144', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
