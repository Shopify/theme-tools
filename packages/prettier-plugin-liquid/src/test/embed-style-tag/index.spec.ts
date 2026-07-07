import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: embed-style-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
