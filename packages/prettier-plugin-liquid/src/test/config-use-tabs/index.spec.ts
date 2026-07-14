import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: config-use-tabs', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
