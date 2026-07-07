import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-capture', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
