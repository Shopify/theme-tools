import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: issue-162', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
