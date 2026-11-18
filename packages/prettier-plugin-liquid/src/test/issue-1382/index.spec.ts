import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('issue-1382', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
