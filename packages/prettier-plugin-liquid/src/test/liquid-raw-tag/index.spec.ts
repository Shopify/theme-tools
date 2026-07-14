import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-raw-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
