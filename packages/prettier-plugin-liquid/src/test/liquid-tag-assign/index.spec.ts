import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-assign', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
