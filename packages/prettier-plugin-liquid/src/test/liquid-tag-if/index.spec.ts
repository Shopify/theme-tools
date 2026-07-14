import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-if', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
