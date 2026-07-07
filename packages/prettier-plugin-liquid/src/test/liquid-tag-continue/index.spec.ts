import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-continue', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
