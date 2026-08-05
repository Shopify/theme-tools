import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: issue-144', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
