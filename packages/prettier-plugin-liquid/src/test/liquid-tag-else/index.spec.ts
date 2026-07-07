import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-else', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
