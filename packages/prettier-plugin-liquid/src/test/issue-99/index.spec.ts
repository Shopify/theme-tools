import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: issue-99', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
