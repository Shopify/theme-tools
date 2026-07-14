import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: issue-99', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
