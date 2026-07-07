import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-cycle', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
