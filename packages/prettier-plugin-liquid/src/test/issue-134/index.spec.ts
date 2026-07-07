import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: issue-134', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
