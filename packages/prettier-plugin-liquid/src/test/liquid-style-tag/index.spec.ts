import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-style-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
