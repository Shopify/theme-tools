import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: issue-156', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
